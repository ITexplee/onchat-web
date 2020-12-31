import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ActiveClassModule } from 'src/app/modules/active-class.module';
import { HideScrollbarModule } from 'src/app/modules/hide-scrollbar.module';
import { SharedModule } from 'src/app/modules/shared.module';
import { ChatroomComponent } from './chatroom/chatroom.component';
import { ContactPageRoutingModule } from './contact-routing.module';
import { ContactPage } from './contact.page';
import { FriendComponent } from './friend/friend.component';
import { NewComponent } from './new/new.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ContactPageRoutingModule,
    SharedModule,
    HideScrollbarModule,
    ActiveClassModule
  ],
  declarations: [
    NewComponent,
    FriendComponent,
    ChatroomComponent,
    ContactPage
  ]
})
export class ContactPageModule { }
