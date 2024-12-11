import { Component, OnInit } from '@angular/core';
import { PhotoService } from '../../services/photo.service';
import { NavBarComponent } from "../../../shared/components/nav-bar/nav-bar.component";
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { GalleryComponent } from "../../components/gallery/gallery.component";
import { AuthService } from '../../../auth/services/auth.service';
import { Router } from '@angular/router';
import { GetAllPhotosService } from '../../services/get-all-photos.service';

@Component({
  selector: 'app-photo-page',
  standalone: true,
  templateUrl: './photo-page.component.html',
  styleUrls: ['./photo-page.component.css'],
  imports: [NavBarComponent, CommonModule, GalleryComponent],
})
export class PhotoPageComponent implements OnInit {
  photo: any;
  user: any = null;
  userId : number = 0;

  constructor(private getAllPhotosService: GetAllPhotosService, private photoService: PhotoService, private route: ActivatedRoute, private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
     this.getPhotoById();

     this.authService.currentUser$.subscribe((user) => {
      this.user = user;
    });

    if (!this.user) {
      this.authService.getCurrentUser().subscribe({
        error: () => {
          console.error('Error fetching user');
        },
      });
    }
  }

 getPhotoById(): void {
    const photoId = Number(this.route.snapshot.paramMap.get('id'));
    if (photoId) {
      this.photoService.getPhotoById(photoId).subscribe({
        next: (data) => {
          this.photo = data;
        },
        error: (error) => {
          console.error('Error fetching photo:', error);
        }
      });
    } else {
      console.error('No photo ID provided');
    }
  }


  async toggleLike(photo: any) {
    if(this.user)
      this.userId = this.user.userId;
    else 
      this.router.navigate(['auth/login']);

    if (!photo.isLiked) {
      this.photoService.likePhoto(photo.id, this.userId).subscribe({
        next: (res) => {
          photo.isLiked = true;
        },
        error: (err) => {
          console.error('Error liking photo:', err.error?.Message || err.message);
        }
      });
    } 
    else {
      this.photoService.unlikePhoto(photo.id, this.userId).subscribe({
        next: (res) => {
          photo.isLiked = false;
        },
        error: (err) => {
          console.error('Error unliking photo:', err.error?.Message || err.message);
        },
      });
    }

    await this.getPhotoById();
  }
}
