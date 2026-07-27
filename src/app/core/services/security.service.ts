import { Service } from '@angular/core';
import { AppSettings } from '../models/finance.models';

interface SpendzoNativeBridge {
  isBiometricAvailable(): boolean;
  enableBiometric(secret: string): void;
  authenticateBiometric(): void;
  disableBiometric(): void;
  hideSplash(): void;
  exitApp(): void;
}

interface NativeWindow extends Window {
  SpendzoNative?: SpendzoNativeBridge;
}

export interface PinCredentials {
  readonly pinSalt: string;
  readonly pinVerifier: string;
  readonly pinIterations: number;
}

const ITERATIONS = 210_000;

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

@Service()
export class SecurityService {
  readonly biometricAvailable =
    (window as NativeWindow).SpendzoNative?.isBiometricAvailable() ?? false;

  async createPin(pin: string): Promise<PinCredentials> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return {
      pinSalt: bytesToBase64(salt),
      pinVerifier: await this.derive(pin, salt, ITERATIONS),
      pinIterations: ITERATIONS,
    };
  }

  async verifyPin(pin: string, settings: AppSettings): Promise<boolean> {
    if (!settings.pinSalt || !settings.pinVerifier || !settings.pinIterations) return false;
    const verifier = await this.derive(
      pin,
      base64ToBytes(settings.pinSalt),
      settings.pinIterations,
    );
    return this.constantTimeEqual(verifier, settings.pinVerifier);
  }

  enableBiometric(pinVerifier: string): void {
    (window as NativeWindow).SpendzoNative?.enableBiometric(pinVerifier);
  }

  requestBiometric(): void {
    (window as NativeWindow).SpendzoNative?.authenticateBiometric();
  }

  disableBiometric(): void {
    (window as NativeWindow).SpendzoNative?.disableBiometric();
  }

  hideNativeSplash(): void {
    (window as NativeWindow).SpendzoNative?.hideSplash();
  }

  exitApp(): void {
    (window as NativeWindow).SpendzoNative?.exitApp();
  }

  private async derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
      key,
      256,
    );
    return bytesToBase64(new Uint8Array(bits));
  }

  private constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }
}
