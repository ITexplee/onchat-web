import { Injectable } from '@angular/core';
import { ChatSessionType, LocalStorageKey } from '../common/enum';
import { ChatRequest, ChatSession, FriendRequest, User } from '../models/onchat.model';
import { EntityUtil } from '../utils/entity.util';
import { LocalStorageService } from './local-storage.service';

@Injectable({
  providedIn: 'root'
})
export class GlobalDataService {
  /** 当前用户 */
  private _user: User = null;
  /** 记录当前所在的聊天室ID */
  private _chatroomId: number = null;
  /** 未读消息总数 */
  private _unreadMsgCount: number = 0;
  /** 是否可以销毁（返回上一页） */
  private _canDeactivate: boolean = true;
  /** 我的收到好友申请列表 */
  private _receiveFriendRequests: FriendRequest[] = [];
  /** 我的发起的好友申请列表 */
  private _sendFriendRequests: FriendRequest[] = [];
  /** 我收到的群通知 */
  private _receiveChatRequests: ChatRequest[] = [];
  /** 缓存聊天列表 */
  private _chatSessions: ChatSession[] = [];
  /** 缓存聊天列表的分页页码 */
  private _chatSessionsPage: number = 1;
  /** 私聊聊天室列表 */
  private _privateChatrooms: ChatSession[] = [];
  /** 私聊聊天室列表的分页页码 */
  private _privateChatroomsPage: number = 1;
  /** 导航/路由加载中 */
  private _navigationLoading: boolean = false;

  constructor(
    private localStorageService: LocalStorageService
  ) { }

  set user(user: User) {
    this._user = user;
  }

  get user() {
    return this._user;
  }

  set chatroomId(id: number) {
    this._chatroomId = id;
  }

  get chatroomId() {
    return this._chatroomId;
  }

  set canDeactivate(deactivate: boolean) {
    this._canDeactivate = deactivate;
  }

  get canDeactivate() {
    return this._canDeactivate;
  }

  set receiveFriendRequests(requests: FriendRequest[]) {
    this._receiveFriendRequests = requests;
  }

  get receiveFriendRequests() {
    return this._receiveFriendRequests;
  }

  set sendFriendRequests(requests: FriendRequest[]) {
    this._sendFriendRequests = requests;
  }

  get sendFriendRequests() {
    return this._sendFriendRequests;
  }

  set receiveChatRequests(requests: ChatRequest[]) {
    this._receiveChatRequests = requests;
    this.sortChatRequests();
  }

  get receiveChatRequests() {
    return this._receiveChatRequests;
  }

  set unreadMsgCount(num: number) {
    this._unreadMsgCount = num > 0 ? num : 0;
    'setAppBadge' in navigator && (navigator as any).setAppBadge(this._unreadMsgCount);
  }

  get unreadMsgCount() {
    return this._unreadMsgCount;
  }

  set chatSessions(chatSessions: ChatSession[]) {
    this._chatSessions = chatSessions;
    this.sortChatSessions();
    this.localStorageService.set(LocalStorageKey.ChatSessions, this.chatSessions);
  }

  get chatSessions(): ChatSession[] {
    return this._chatSessions;
  }

  set chatSessionsPage(page: number) {
    this._chatSessionsPage = page;
  }

  get chatSessionsPage() {
    return this._chatSessionsPage;
  }

  set privateChatrooms(privateChatrooms: ChatSession[]) {
    this._privateChatrooms = privateChatrooms.sort((a: ChatSession, b: ChatSession) => {
      return a.title.localeCompare(b.title);
    });
  }

  get privateChatrooms(): ChatSession[] {
    return this._privateChatrooms;
  }

  set privateChatroomsPage(page: number) {
    this._privateChatroomsPage = page;
  }

  get privateChatroomsPage() {
    return this._privateChatroomsPage;
  }

  set navigationLoading(loading: boolean) {
    this._navigationLoading = loading;
  }

  get navigationLoading() {
    return this._navigationLoading;
  }

  /**
   * 计算未读消息数
   */
  totalUnreadMsgCount() {
    if (this.unreadMsgCount > 0) {
      this.unreadMsgCount = 0;
    }

    this.totalUnreadChatRequestCount();

    for (const chatSession of this.chatSessions) {
      // 计算未读消息总数，如果有未读消息，
      // 且总未读数大于100，则停止遍历
      if (chatSession.unread > 0 && (this.unreadMsgCount += chatSession.unread) >= 100) {
        break;
      }
    }
  }

  /**
   * 计算未读的聊天室通知消息数量
   */
  private totalUnreadChatRequestCount() {
    const unreadCount = this.receiveChatRequests.reduce((count, o) => {
      return count + (o.readedList.includes(this.user.id) ? 0 : 1);
    }, 0);

    const chatSession = this.chatSessions.find(o => o.type === ChatSessionType.ChatroomNotice);
    if (chatSession) {
      chatSession.unread = unreadCount;
    }
  }

  /**
   * 按照时间/置顶顺序排序聊天列表
   */
  sortChatSessions() {
    this.chatSessions.sort(EntityUtil.sortByUpdateTime).sort((a, b) => +b.sticky || 0 - +a.sticky || 0);
  }

  /**
   * 排序聊天室通知
   */
  sortChatRequests() {
    this.receiveChatRequests.sort(EntityUtil.sortByUpdateTime);
  }
}
