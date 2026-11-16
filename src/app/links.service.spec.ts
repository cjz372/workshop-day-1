import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { LinkRecord, LinksService } from './links.service';

const exampleLink: LinkRecord = {
  code: 'a1B2c3',
  url: 'https://example.com/a-long-page',
  shortUrl: 'http://localhost:3000/a1B2c3',
  hits: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('LinksService', () => {
  let service: LinksService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LinksService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the link list from the shared API route', () => {
    service.getLinks().subscribe((links) => expect(links).toEqual([exampleLink]));

    const request = http.expectOne('http://localhost:3000/api/links');
    expect(request.request.method).toBe('GET');
    request.flush([exampleLink]);
  });

  it('posts the URL and returns the created link', () => {
    service.createLink(exampleLink.url).subscribe((link) => expect(link).toEqual(exampleLink));

    const request = http.expectOne('http://localhost:3000/api/links');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ url: exampleLink.url });
    request.flush(exampleLink);
  });
});
