import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { LinkRecord, LinksService } from './links.service';

const httpUrlValidator: ValidatorFn = (control): ValidationErrors | null => {
  const value = control.value;
  if (typeof value !== 'string' || value.length === 0) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
};

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly linksService = inject(LinksService);

  readonly linkForm = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, httpUrlValidator],
    }),
  });
  readonly links = signal<LinkRecord[]>([]);
  readonly isLoading = signal(true);
  readonly listError = signal('');
  readonly isSubmitting = signal(false);
  readonly successLink = signal<LinkRecord | null>(null);
  readonly submitError = signal('');

  get urlControl(): FormControl<string> {
    return this.linkForm.controls.url;
  }

  ngOnInit(): void {
    this.loadLinks();
  }

  loadLinks(): void {
    this.isLoading.set(true);
    this.listError.set('');
    this.linksService.getLinks().subscribe({
      next: (links) => {
        this.links.set(links);
        this.isLoading.set(false);
      },
      error: () => {
        this.listError.set(
          'Could not load links. Check that the Snip API is running, then try again.',
        );
        this.isLoading.set(false);
      },
    });
  }

  submitLink(): void {
    if (this.isSubmitting()) return;

    if (this.linkForm.invalid) {
      this.linkForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.successLink.set(null);
    this.submitError.set('');

    this.linksService.createLink(this.urlControl.value).subscribe({
      next: (link) => {
        this.successLink.set(link);
        this.linkForm.reset();
        this.isSubmitting.set(false);
        this.loadLinks();
      },
      error: (error: unknown) => {
        this.submitError.set(this.getErrorMessage(error));
        this.isSubmitting.set(false);
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.error;
      if (typeof message === 'string') return message;
      if (error.status === 0) {
        return 'Could not reach the Snip API. Check your connection and try again.';
      }
    }
    return 'Something went wrong while shortening this URL. Please try again.';
  }
}
