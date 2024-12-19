import { Component, HostListener } from '@angular/core';
import { GetAllPhotosService } from '../../services/Photos/get-all-photos.service';
import { OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import _ from 'lodash';
import { AuthService } from '../../../auth/services/auth.service';
import { PhotoService } from '../../services/photo.service';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PhotosSearchService } from '../../services/Photos/photos-search.service';
import { FormsModule } from '@angular/forms';
import { SearchRequest } from '../../model/SearchRequest';
import { PhotoGetAllRequest } from '../../model/PhotoGetAllRequest';
import { PhotoGetAllResult } from '../../model/PhotoGetAllResult';
import { SearchResult } from '../../model/SearchResult';
import { UserService } from '../../services/user.service';
import { Subject, takeUntil } from 'rxjs';
import {PhotoEndpointsService} from '../../../admin/services/Endpoints/Photo/photo-endpoints.service';

export class AppModule {}
@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule ],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent implements OnInit, OnDestroy {
 
  searchRequest : SearchRequest = {
     Popularity: '',
     Title: '',
     Orientation: null,
     Size: null,
     Color: null,
     PageNumber: 1,
     PageSize: 10,
     UserId: null,
 
  };
 
  searchResult : SearchResult = {
    Photos: [],
    TotalPhotos: 0,
    TotalPages: 0,
    PageNumber: 1,
    PageSize: 0
  }
 
  getAllRequest : PhotoGetAllRequest = {
    PageNumber: 1,
    PageSize: 2
  }
 
  getAllResult : PhotoGetAllResult = {
    Photos: [],
    TotalPhotos: 0,
    TotalPages: 0,
    PageNumber: 1,
    PageSize: 0
  }
 
  photos: any[] = [];
  originalPhotos: any[] = [];
  isLoading: boolean = false;
  private ngOnDestory = new Subject<void>();

  selectedOption: string = 'photos';
  selectedFilter: string = 'trending';
 
  user: any | null = null;
  currentUrl : string = '';
  username: string | null = null;
  param : string | null = null;
  isAdminPage: boolean = false;
 
 
  //more filters  section
  currentPopularity : string = 'Trending';
  currentOrientation : string = 'All Orientations';
  currentSize : string = 'All Sizes';
  selectedColor: string = '';
  isMoreFiltersDropdownOpen: boolean = false;
  openMoreFiltersDropdown: string | null = null;
  isFilterDropdownOpen: boolean = false;
 
  //colors dropdown
  predefinedColors: string[] = [
    '#795548', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
    '#FF5722', '#9E9E9E', '#607D8B', '#000000', '#FFFFFF'
  ];
 
  constructor(private getAllPhotosService: GetAllPhotosService,
              private authService: AuthService, private router: Router, private photoService: PhotoService,
              private route: ActivatedRoute,
              private photosSearchService: PhotosSearchService, private userService: UserService,
              private photoEndpointsService: PhotoEndpointsService
              ) { }
 
 
 
  ngOnInit(): void {
    this.checkUrl();
    console.log(this.isAdminPage);
    if(!this.isAdminPage){
    this.route.paramMap.pipe(takeUntil(this.ngOnDestory)).subscribe(params => {
      this.username = params.get('username');
      if (this.param) this.loadPhotos();
      

      this.param = params.get('liked')
      if (this.param) this.loadLikedPhotos();
    });

    this.checkUser();
    this.checkQueryParams();
    this.loadPhotos();
    
  }
    this.showImagesToAdmin();
  }




  ngOnDestroy(): void {
    this.ngOnDestory.next();
    this.ngOnDestory.complete();
  }


  showImagesToAdmin(){
    this.userService.updateAdminPhotos$.pipe(takeUntil(this.ngOnDestory)).subscribe((value) => {
      const show = value === null ? null : value
      if(show){
        this.AdminloadUserPhotos();
      }
      else{
        this.photos = [];
      }
    })
  }

  AdminloadUserPhotos(){
    if(!this.username) return;
    this.userService.getUserByUsernameAdmin(this.username).pipe(takeUntil(this.ngOnDestory)).subscribe({
      next : (user) => {
        this.photos = user.photos;
        console.log(this.photos);
      },
      error : (error) => {
        console.log(error);
      }
    })
  }
 
 
  checkUrl(){
    this.route.url.pipe(takeUntil(this.ngOnDestory)).subscribe((segment) => {
      this.currentUrl = segment.join('/');
      this.isAdminPage = this.router.url.includes('admin');
    })
  }
 
  checkQueryParams(){
    this.route.queryParams.pipe(takeUntil(this.ngOnDestory)).subscribe(params => {
      this.searchRequest =
      {  
         Popularity: this.currentPopularity,
         Title: params['q'],
         Orientation: params['orientation'],
         Size: params['size'],
         Color: params['color'],
         PageNumber: 1,
         PageSize: 10,
         UserId: params['UserId'],
      };
      if (this.currentUrl.includes('search')) {
        this.loadSearchPhotos();
      }
    })
  }
 
  checkUser(){
    this.authService.currentUser$.pipe(takeUntil(this.ngOnDestory)).subscribe((user) => {
      this.user = user === null ? null : user
      console.log(this.user);
    });
  }
 
  loadSearchPhotos() {
    this.isLoading = true;
    this.photos = [];
    this.searchResult.Photos = [];
    this.photosSearchService.searchPhotos(this.searchRequest).pipe(takeUntil(this.ngOnDestory)).subscribe({
      next: (res) => {
        this.searchResult.Photos = [...this.searchResult.Photos, ...res.photos];
        this.photos = this.searchResult.Photos
        this.updateQueryString();  
        this.searchResult.TotalPhotos = res.totalPhotos;
        this.searchResult.TotalPages = res.totalPages;
        this.searchRequest.PageNumber++;
        console.log(this.photos);
      },
      error: (error) => {
        console.error('Error fetching photos:', error);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
 
  loadPopularPhotos() {
    if (this.isLoading) return;
    if(this.getAllResult.TotalPages > 0){
      if (this.getAllRequest.PageNumber > this.getAllResult.TotalPages) return;
    }  
    this.isLoading = true;
    this.getAllPhotosService.getAllPhotos(this.getAllRequest).pipe(takeUntil(this.ngOnDestory)).subscribe({
      next: (res) => {
        console.log(res);
        this.getAllResult.Photos = [...this.getAllResult.Photos, ...res.photos];
        this.photos =this.getAllResult.Photos
        this.getAllResult.TotalPages = res.totalPages;  
        this.getAllRequest.PageNumber++;  
      },
      error: (error) => {
        console.error('Error fetching photos:', error);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
 
  loadUserPhotos(): void {
    if (!this.username) return; // Dodajte ovu provjeru
    this.userService.getUserByUsername(this.username).pipe(takeUntil(this.ngOnDestory)).subscribe({
      next: (res) => {
        this.photos = res.photos;
        console.log(this.photos);
      },
      error: (error) => {
        console.error('Error fetching photos:', error);
      },
    });
  }
  
  
 
  loadPhotos() {
    if(this.currentUrl.includes('search')) this.loadSearchPhotos();
    if(this.currentUrl.includes('home')) this.loadPopularPhotos();
    if(this.currentUrl === `user/${this.username}` && !this.isAdminPage) this.loadUserPhotos();
    if(this.currentUrl === `user/${this.username}/liked` && !this.isAdminPage) this.loadLikedPhotos();
    if(this.currentUrl === `user/${this.username}/gallery` && !this.isAdminPage) this.loadUserPhotos();
    if(this.currentUrl.includes('new-posts')) this.loadAdminPhotos();
  }

  loadAdminPhotos(){
    if(this.isLoading) return;
    this.photoEndpointsService.getAllPhotos().pipe(takeUntil(this.ngOnDestory)).subscribe({
      next: (res) => {
        console.log(res);
        this.photos = res.photos;
      },
      error: (error) => {
        console.error('Error fetching photos:', error);
      },
    })
  }

  loadLikedPhotos(): void {
    if (!this.username) return;
    this.userService.getUserLikedPhotos(this.username).pipe(takeUntil(this.ngOnDestory)).subscribe({
      next: (res) => {
        this.photos = []
        this.photos = res;
        console.log(this.photos);
      },
      error: (error) => {
        console.error('Error fetching liked photos:', error);
      },
    });
  }
  
 
  loadMoreItems() {
    if (this.isLoading) return;
    if (this.currentUrl.includes('search')) {
      if (this.searchRequest.PageNumber <= this.searchResult.TotalPages) {
        this.loadSearchPhotos();
      }
    }
    if (this.currentUrl.includes('home')) {
      if (this.getAllRequest.PageNumber <= this.getAllResult.TotalPages) {
        this.loadPopularPhotos();
      }
    }
  }
 
    @HostListener('window:scroll', ['$event'])
    onScroll(event: Event): void {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
 
      // Provjera je li korisnik došao do 90% stranice
      if (scrollPosition + windowHeight >= documentHeight * 0.9) {
        this.loadMoreItems();
      }
    }
 
 
    toggleLike(photo: any, event: Event) {
      if(!this.user)
        this.router.navigate(['auth/login']);
      
      event.stopPropagation();
      const action = photo.isLiked ? this.photoService.unlikePhoto(photo.id, this.user.userId).pipe(takeUntil(this.ngOnDestory)) : this.photoService.likePhoto(photo.id, this.user.userId).pipe(takeUntil(this.ngOnDestory));
   
      action.subscribe({
        next: () => {
          photo.isLiked = !photo.isLiked; // Toggle state
          if(this.currentUrl === (`user/${this.username}/liked`)) this.loadLikedPhotos();
        },
        error: (err) => {
          console.error('Error updating like status:', err.error?.Message || err.message);
        }
      });
    }
   
   
 
  openPhotoDetail(photo: any) {
    this.router.navigate(['public/photo', photo.id]);
  }
 
 
  selectOption(option: string) {
    this.selectedOption = option;
  }
 
  toggleFilterDropdown() {
    this.isFilterDropdownOpen = !this.isFilterDropdownOpen;
  }
 
  toggleMoreFiltersDropdown(dropdownId: string) {
    this.openMoreFiltersDropdown =
      this.openMoreFiltersDropdown === dropdownId ? null : dropdownId;
  }
 
  closeDropdowns() {
    this.isFilterDropdownOpen = false;
    this.openMoreFiltersDropdown = null;
  }
 
  toggleMoreFilterDropdown(){
    this.isMoreFiltersDropdownOpen = !this.isMoreFiltersDropdownOpen;
    console.log(this.isMoreFiltersDropdownOpen);
  }
 
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
 
    // Proveri da li je klik izvan dropdowna
    if (!target.closest('.dropdown') && !target.closest('.filter-select')) {
      this.closeDropdowns();
    }
  }
 
  updateQueryString() {
    const queryParams: any = {};
 
    queryParams.orientation = this.currentOrientation !== 'All Orientations'
    ? this.currentOrientation.toLowerCase()
    : null;
 
    queryParams.size = this.currentSize !== 'All Sizes'
    ? this.currentSize.toLowerCase()
    : null;
 
    queryParams.popularity = this.currentPopularity;
 
    queryParams.color = this.selectedColor !== null
    ? this.selectedColor.toLowerCase()
    : null;

    queryParams.UserId = this.user?.userId ?? null;


    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
 
  selectOrientation(orientation: string) {
    this.currentOrientation = orientation;
    this.updateQueryString();
  }
 
  selectSize(size: string) {
    this.currentSize = size;
    this.updateQueryString();
  }
  selectPopularity(popularity: string) {
    this.currentPopularity = popularity;
    this.updateQueryString();
  }
 
  setColor(color: string) {
    this.selectedColor = color;
    if(this.validateHexCode()) this.updateQueryString();
  }
 
  validateHexCode() {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(this.selectedColor)) {
      return false;
    }
    return true;
    this.checkQueryParams();
  }
 
}
 