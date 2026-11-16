import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { LinkRecord, LinksService } from './links.service';

const exampleLink: LinkRecord = {
  code: 'a1B2c3',
  url: 'https://example.com/a-long-page',
  shortUrl: 'http://localhost:3000/a1B2c3',
  hits: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AppComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AppComponent>>;
  let linksService: jasmine.SpyObj<LinksService>;

  beforeEach(async () => {
    linksService = jasmine.createSpyObj<LinksService>('LinksService', ['getLinks', 'createLink']);
    linksService.getLinks.and.returnValue(of([]));
    linksService.createLink.and.returnValue(of(exampleLink));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: LinksService, useValue: linksService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  it('loads the links table and displays short link, original URL, and hits', () => {
    linksService.getLinks.and.returnValue(of([exampleLink]));
    fixture.componentInstance.loadLinks();
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLTableRowElement;
    expect(row.textContent).toContain(exampleLink.shortUrl);
    expect(row.textContent).toContain(exampleLink.url);
    expect(row.textContent).toContain('0');
  });

  it('rejects invalid URLs without calling the API', () => {
    fixture.componentInstance.urlControl.setValue('ftp://example.com');
    fixture.componentInstance.submitLink();
    fixture.detectChanges();

    expect(linksService.createLink).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid HTTP or HTTPS URL.');
  });

  it('shows the returned short link and refreshes the table after success', () => {
    fixture.componentInstance.urlControl.setValue(exampleLink.url);
    fixture.componentInstance.submitLink();
    fixture.detectChanges();

    expect(linksService.createLink).toHaveBeenCalledOnceWith(exampleLink.url);
    expect(fixture.nativeElement.textContent).toContain('Your short link is ready:');
    expect(fixture.nativeElement.textContent).toContain(exampleLink.shortUrl);
    expect(linksService.getLinks).toHaveBeenCalledTimes(2);
  });

  it('shows the API error beside the form and prevents duplicate submissions', () => {
    const pending = new Subject<LinkRecord>();
    linksService.createLink.and.returnValue(pending);
    fixture.componentInstance.urlControl.setValue(exampleLink.url);

    fixture.componentInstance.submitLink();
    fixture.componentInstance.submitLink();
    fixture.detectChanges();

    expect(linksService.createLink).toHaveBeenCalledTimes(1);
    pending.error(new HttpErrorResponse({ status: 400, error: { error: 'Invalid URL' } }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Invalid URL');
    expect(fixture.componentInstance.isSubmitting()).toBeFalse();
  });
});
