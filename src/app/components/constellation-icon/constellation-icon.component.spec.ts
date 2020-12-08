import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ConstellationIconComponent } from './constellation-icon.component';

describe('ConstellationIconComponent', () => {
  let component: ConstellationIconComponent;
  let fixture: ComponentFixture<ConstellationIconComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ConstellationIconComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(ConstellationIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
