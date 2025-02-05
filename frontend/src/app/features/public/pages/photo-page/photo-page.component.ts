import { Component, OnInit } from '@angular/core';
import { PhotoService } from '../../services/photo.service';
import { NavBarComponent } from "../../../shared/components/nav-bar/nav-bar.component";
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { GalleryComponent } from "../../components/gallery/gallery.component";
import { AuthService } from '../../../auth/services/auth.service';
import { Router } from '@angular/router';
import { CustomDatePipe } from '../../helper/custom-date.pipe';
import { Location } from '@angular/common';
import { StripeService } from '../../services/stripe.service';
import { ChangeDetectorRef } from '@angular/core';
import { Subject,takeUntil } from 'rxjs';
@Component({
  selector: 'app-photo-page',
  standalone: true,
  templateUrl: './photo-page.component.html',
  styleUrls: ['./photo-page.component.css'],
  imports: [NavBarComponent, CommonModule, GalleryComponent, CustomDatePipe],
})
export class PhotoPageComponent implements OnInit {
  photo: any;
  currentUser: any = null;
  currentUserId : number = 0;
  profileUserId: number = 0;
  isOwnProfile: boolean = false;
  public isLoading: boolean = false;
  similarObject: string[] = [];
  private ngOnDestory = new Subject<void>();
  currentUrl:string = '';
  constructor(
    private photoService: PhotoService, 
    private route: ActivatedRoute, 
    private authService: AuthService, 
    private router: Router,
    private stripeService: StripeService,
    private location: Location,private cdr: ChangeDetectorRef) {}
    
  ngOnInit(): void {
    this.checkUrl();

     this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });

    if (!this.currentUser) {
      this.authService.getCurrentUser().subscribe({
        error: () => {
          console.error('Error fetching user');
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.ngOnDestory.next();
    this.ngOnDestory.complete();
  }

  checkUrl(){
      this.route.url.pipe(takeUntil(this.ngOnDestory)).subscribe((segment) => {
        this.currentUrl = segment.map(segment => segment.path).join('/');
        this.getPhotoById();
      })
    }


  goToSearchPage(tag: string): void {
    console.log("okkkk")
    this.router.navigate(["/public/search/photos"], { queryParams: { q: tag } });
  }

  goToEditPhoto() {
    this.router.navigate([`auth/photo/${this.photo.id}/edit`]);
  }

 getPhotoById(): void {
    const photoId = Number(this.route.snapshot.paramMap.get('id'));
    if (photoId) {
      this.photoService.getPhotoById(photoId).subscribe({
        next: (data) => {
          this.photo = data;
          console.log(this.photo);
          this.profileUserId = data.user.id;
          this.similarObject = [...(this.photo.tags || [])]
          this.checkIfOwnprofile();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (error) => {
          console.error('Error fetching photo:', error);
          this.location.back();
        }
        
      });
    } else {
      console.error('No photo ID provided');
    }
  }

  private checkIfOwnprofile(): void{
    if(this.currentUser && this.currentUser.userId === this.profileUserId)
      this.isOwnProfile = true;
    else
      this.isOwnProfile = false; 
  }

  goToAuthorProfile(){
      this.router.navigate([`public/profile/user/${this.photo.user.username}`])
  }


  toggleLike(photo: any, event: Event) {
    if(this.currentUser)
      this.currentUserId = this.currentUser.userId;
    else 
      this.router.navigate(['auth/login']);

      event.stopPropagation();
      const action = photo.isLiked ? this.photoService.unlikePhoto(photo.id, this.currentUser.userId) : this.photoService.likePhoto(photo.id, this.currentUser.userId);
   
      action.subscribe({
        next: () => {
          photo.isLiked = !photo.isLiked;
          this.getPhotoById();
        },
        error: (err) => {
          console.error('Error updating like status:', err.error?.Message || err.message);
        },
      });
  }

  toggleBookmar(photo: any, event: Event) {
    if(this.currentUser)
      this.currentUserId = this.currentUser.userId;
    else 
      this.router.navigate(['auth/login']);

      event.stopPropagation();
      const action = photo.isBookmarked ? this.photoService.unbookmarkPhoto(photo.id, this.currentUser.userId) : this.photoService.bookmarkPhoto(photo.id, this.currentUser.userId);
   
      action.subscribe({
        next: () => {
          photo.isBookmarked = !photo.isBookmarked;
          this.getPhotoById();
        },
        error: (err) => {
          console.error('Error updating bookmark status:', err.error?.Message || err.message);
        },
      });
  }

  purchase() {
    if (this.photo) {
      this.isLoading = true;
      const amount = this.photo.price;
      const currency = 'USD';
      const photoImage = this.photo.url;
      const photoDescription = this.photo.description;
      const photoId = this.photo.id;
      this.stripeService.checkout(amount, currency, photoImage, photoDescription, photoId).subscribe({
        next: (response) => {
          this.stripeService.redirectToCheckout(response.sessionId);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error creating checkout session:', error);
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    }
  }
}
