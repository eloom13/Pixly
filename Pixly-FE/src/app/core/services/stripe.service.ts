import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { loadStripe } from '@stripe/stripe-js';
import { from, map, Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface CreateCheckoutRequest {
  photoId: number;
  amount: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResponse {
  sessionId: string;
  checkoutUrl: string;
}

@Injectable({ providedIn: 'root' })
export class StripeService {
  private stripePromise = loadStripe(environment.stripePublishableKey);

  private baseUrl = `${environment.apiUrl}/payment`;

  constructor(private http: HttpClient) {}

  checkout(photoId: number, amount: number): Observable<CheckoutResponse> {
  const body: CreateCheckoutRequest = {
    photoId,
    amount,
    successUrl: `${window.location.origin}/public/checkout/success?sid={CHECKOUT_SESSION_ID}&pid=${photoId}`,
    cancelUrl: `${window.location.origin}/public/checkout/cancel`,
  };

  return this.http
    .post<CheckoutResponse | { id: string }>(`${this.baseUrl}/create-checkout-session`, body)
    .pipe(
      map((res: any) => ({
        sessionId: res.sessionId ?? res.id,
        checkoutUrl: res.checkoutUrl ?? ''
      }))
    );
}


  async redirectToCheckout(sessionId: string) {
    const stripe = await this.stripePromise;
    if (!stripe) throw new Error('Stripe nije inicijaliziran');
    const { error } = await stripe.redirectToCheckout({ sessionId });
    if (error) throw error;
  }

  verifyPayment(sessionId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.baseUrl}/verify-payment/${encodeURIComponent(sessionId)}`,
      {}
    );
  }

  getPurchaseBySession(sessionId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/purchase/session/${encodeURIComponent(sessionId)}`);
  }

  getPurchases(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/purchases`);
  }

  downloadPhoto(photoId: number): Observable<Blob> {
    return this.http
      .get<{ data: string }>(`${environment.apiUrl}/photo/orginal/${photoId}`)
      .pipe(
        map(res => res.data),
        switchMap((url) => from(fetch(url)).pipe(
          switchMap(resp => {
            if (!resp.ok) throw new Error('Download failed');
            return resp.blob();
          })
        ))
      );
  }
}
