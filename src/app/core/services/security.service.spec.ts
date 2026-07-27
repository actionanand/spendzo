import { TestBed } from '@angular/core/testing';
import { AppSettings, DEFAULT_SETTINGS } from '../models/finance.models';
import { SecurityService } from './security.service';

describe('SecurityService', () => {
  let service: SecurityService;

  beforeEach(() => {
    service = TestBed.inject(SecurityService);
  });

  it('creates a salted verifier and validates the right PIN', async () => {
    const credentials = await service.createPin('2468');
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      pinEnabled: true,
      ...credentials,
    };

    expect(credentials.pinVerifier).not.toContain('2468');
    expect(await service.verifyPin('2468', settings)).toBe(true);
    expect(await service.verifyPin('1357', settings)).toBe(false);
  });

  it('rejects verification when credentials are absent', async () => {
    expect(await service.verifyPin('2468', DEFAULT_SETTINGS)).toBe(false);
  });
});
