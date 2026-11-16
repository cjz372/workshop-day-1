import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiEndpoint } from './api-endpoint';

export interface LinkRecord {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = apiEndpoint;

  getLinks(): Observable<LinkRecord[]> {
    return this.http.get<LinkRecord[]>(this.endpoint);
  }

  createLink(url: string): Observable<LinkRecord> {
    return this.http.post<LinkRecord>(this.endpoint, { url });
  }
}
