import { Component, ElementRef, Inject, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { merge, of } from 'rxjs';
import { filter, map, mergeMap, take, takeUntil, tap } from 'rxjs/operators';
import { AudioName, RtcDataType, SocketEvent } from 'src/app/common/enums';
import { success } from 'src/app/common/operators';
import { WINDOW } from 'src/app/common/tokens';
import { Result, User } from 'src/app/models/onchat.model';
import { RtcData } from 'src/app/models/rtc.model';
import { FeedbackService } from 'src/app/services/feedback.service';
import { GlobalData } from 'src/app/services/global-data.service';
import { MediaDevice } from 'src/app/services/media-device.service';
import { Overlay } from 'src/app/services/overlay.service';
import { Rtc } from 'src/app/services/rtc.service';
import { SocketService } from 'src/app/services/socket.service';
import { ModalComponent } from '../modal.component';

@Component({
  selector: 'app-rtc',
  templateUrl: './rtc.component.html',
  styleUrls: ['./rtc.component.scss'],
})
export class RtcComponent extends ModalComponent implements OnInit, OnDestroy {
  /** 对方 */
  @Input() user: User;
  @Input() isRequester: boolean;
  @Input() mediaStream?: MediaStream;
  @ViewChild('remoteVideo', { static: true }) remoteVideo: ElementRef<HTMLVideoElement>;
  @ViewChild('localVideo', { static: true }) localVideo: ElementRef<HTMLVideoElement>;

  waiting: boolean = true;

  private timer: number;

  constructor(
    public globalData: GlobalData,
    private rtc: Rtc,
    private mediaDevice: MediaDevice,
    private socketService: SocketService,
    private feedbackService: FeedbackService,
    @Inject(WINDOW) private window: Window,
    protected overlay: Overlay,
    protected router: Router,
  ) {
    super();
  }

  ngOnInit() {
    super.ngOnInit();

    merge(
      this.socketService.on(SocketEvent.RtcHangUp),
      this.socketService.on(SocketEvent.RtcBusy).pipe(
        tap(({ data: { senderId } }) => senderId === this.user.id && this.busy())
      ),
    ).pipe(
      takeUntil(this.destroy$),
      filter(({ data: { senderId } }) => senderId === this.user.id)
    ).subscribe(() => this.dismiss());

    // 如果自己是申请人，自己先准备好 RTC
    this.isRequester && this.prepare().subscribe();

    this.feedbackService.audio(AudioName.Ring).play();
    this.globalData.rtcing = true;

    // 如果三分钟后还没接通，客户端主动挂断
    this.timer = this.window.setTimeout(() => {
      if (this.waiting) {
        this.isRequester && this.busy();
        this.hangUp();
      }
    }, 60000 * 3);
  }

  ngOnDestroy() {
    this.rtc.close();
    this.overlay.dismissLoading();
    this.feedbackService.audio(AudioName.Ring).pause();
    this.globalData.rtcing = false;
    this.window.clearTimeout(this.timer);
  }

  onVideoPlay() {
    this.overlay.dismissLoading();
    this.waiting = false;
  }

  busy() {
    this.overlay.toast('OnChat：对方正在忙线中，请稍后再试…');
  }

  prepare() {
    return (this.mediaStream ? of(this.mediaStream) : this.mediaDevice.getUserMedia({ video: true, audio: { echoCancellation: true } })).pipe(
      tap(() => {
        this.rtc.create();

        // 侦听 RTC 数据
        this.socketService.on<Result<RtcData>>(SocketEvent.RtcData).pipe(
          takeUntil(this.destroy$),
          success(),
          filter(({ data: { senderId } }) => senderId === this.user.id),
          map(({ data }) => data),
        ).subscribe(({ type, value }) => {
          switch (type) {
            // 添加候选
            case RtcDataType.IceCandidate:
              this.rtc.addIceCandidate(new RTCIceCandidate(value as RTCIceCandidateInit));
              break;

            // 设置远程描述
            case RtcDataType.Description:
              this.rtc.setRemoteDescription(new RTCSessionDescription(value as RTCSessionDescriptionInit));
              // 如果我是请求者，那么 RTC 连接是被请求者发起的，对方是 Offer，我是 Answer
              this.isRequester && this.rtc.createAnswer().subscribe({
                next: description => {
                  this.rtc.setLocalDescription(description);
                  // 让对方设置我的远程描述
                  this.socketService.rtcData(this.user.id, RtcDataType.Description, description);
                },
                error: error => {
                  this.overlay.toast('OnChat：RTC 对等连接应答创建失败！');
                  console.error(error);
                }
              });
              break;
          }
        });

        this.rtc.iceCandidateError.pipe(takeUntil(this.destroy$)).subscribe(error => {
          this.overlay.toast('OnChat：对等连接 ICE 协商失败！');
          console.error(error);
        });

        // 将自己的候选发送给对方
        this.rtc.iceCandidate.pipe(
          takeUntil(this.destroy$),
          map(({ candidate }) => candidate),
          filter(candidate => candidate !== null),
          // 不使用 TCP 流，只使用 UDP 流
          filter(({ candidate }) => !candidate.includes('tcp')),
        ).subscribe(candidate => {
          // 让对方添加我的候选
          this.socketService.rtcData(this.user.id, RtcDataType.IceCandidate, candidate);
        });

        // 侦听轨道
        this.rtc.track.pipe(takeUntil(this.destroy$), take(1)).subscribe(async ({ streams }) => {
          this.overlay.dismissLoading();
          await this.overlay.loading('Ready…');

          this.remoteVideo.nativeElement.srcObject = streams[0];
          this.feedbackService.audio(AudioName.Ring).pause();
        });

        // 侦听连接状态
        this.rtc.connectionStateChange.pipe(
          filter(({ target }) => ['closed', 'failed', 'disconnected'].includes(target.connectionState))
        ).subscribe(() => this.hangUp());
      }),
      tap(stream => {
        this.rtc.setTracks(stream);
        this.localVideo.nativeElement.volume = 0;
        this.localVideo.nativeElement.srcObject = stream;
      })
    );
  }

  /** 被申请人发起连接 */
  call() {
    this.overlay.loading();
    this.prepare().pipe(
      // Safari 暂不支持 negotiationNeeded
      // mergeMap(() => this.rtc.negotiationNeeded.pipe(takeUntil(this.destroy$))),
      // filter(({ target }) => (target as RTCPeerConnection).signalingState === 'stable'),
      mergeMap(() => this.rtc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true }))
    ).subscribe({
      next: description => {
        this.rtc.setLocalDescription(description);
        // 让对方设置我的远程描述
        this.socketService.rtcData(this.user.id, RtcDataType.Description, description);
      },
      error: error => {
        this.overlay.toast('OnChat：RTC 对等连接提供创建失败！');
        console.error(error);
      }
    });
  }

  hangUp() {
    this.socketService.rtcHangUp(this.user.id);
    this.dismiss();
  }

}
