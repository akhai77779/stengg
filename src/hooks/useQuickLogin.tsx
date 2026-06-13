import { useState, useEffect, useCallback } from 'react';
import {
  deriveKeyFromPin,
  encryptData,
  decryptData,
  generateSalt,
  bufferToBase64,
  base64ToBuffer,
} from '@/lib/crypto';

interface StoredCredentials {
  email: string;
  encryptedPassword: string;
  salt: string;
  method: 'pin';
  createdAt: string;
}

interface QuickLoginState {
  isAvailable: boolean;
  method: 'pin' | null;
  email: string | null;
}

const STORAGE_KEY = 'quickLoginCredentials';

export function useQuickLogin() {
  const [state, setState] = useState<QuickLoginState>({
    isAvailable: false,
    method: null,
    email: null,
  });
  // Biometric quick-login removed: storing key material in localStorage made
  // the encrypted password recoverable via XSS. Only PIN-based quick login
  // (key re-derived from the PIN at runtime) is supported.
  const isBiometricSupported = false;

  useEffect(() => {
    checkStoredCredentials();
  }, []);

  const checkStoredCredentials = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const credentials = JSON.parse(stored) as StoredCredentials & { method: string };
      // Migrate away from legacy biometric credentials which stored an AES key
      // in localStorage. Clear them so the user is prompted to re-setup PIN.
      if (credentials.method !== 'pin') {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setState({
        isAvailable: true,
        method: 'pin',
        email: credentials.email,
      });
    } catch (e) {
      console.error('Error checking stored credentials:', e);
    }
  };

  /**
   * Setup PIN-based quick login
   */
  const setupPinLogin = useCallback(async (email: string, password: string, pin: string): Promise<boolean> => {
    try {
      const salt = generateSalt();
      const key = await deriveKeyFromPin(pin, salt);
      const encryptedPassword = await encryptData(password, key);

      const credentials: StoredCredentials = {
        email,
        encryptedPassword,
        salt: bufferToBase64(salt),
        method: 'pin',
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
      
      setState({
        isAvailable: true,
        method: 'pin',
        email,
      });

      return true;
    } catch (e) {
      console.error('Error setting up PIN login:', e);
      return false;
    }
  }, []);

  /**
   * Biometric setup is no longer supported. Kept as a no-op so any
   * remaining callers receive a clear failure rather than crashing.
   */
  const setupBiometricLogin = useCallback(async (_email: string, _password: string): Promise<boolean> => {
    console.warn('Biometric quick login is disabled for security reasons. Use PIN instead.');
    return false;
  }, []);

  /**
   * Unlock with PIN and get credentials
   */
  const unlockWithPin = useCallback(async (pin: string): Promise<{ email: string; password: string } | null> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const credentials: StoredCredentials = JSON.parse(stored);
      if (credentials.method !== 'pin') return null;

      const salt = base64ToBuffer(credentials.salt);
      const key = await deriveKeyFromPin(pin, salt);
      const password = await decryptData(credentials.encryptedPassword, key);

      return { email: credentials.email, password };
    } catch (e) {
      console.error('Error unlocking with PIN:', e);
      return null;
    }
  }, []);

  /**
   * Biometric unlock is no longer supported.
   */
  const unlockWithBiometric = useCallback(async (): Promise<{ email: string; password: string } | null> => {
    return null;
  }, []);

  /**
   * Clear stored credentials
   */
  const clearQuickLogin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      isAvailable: false,
      method: null,
      email: null,
    });
  }, []);

  /**
   * Check if quick login is set up for a specific email
   */
  const isSetupForEmail = useCallback((email: string): boolean => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      const credentials: StoredCredentials = JSON.parse(stored);
      return credentials.email === email;
    } catch {
      return false;
    }
  }, []);

  return {
    ...state,
    isBiometricSupported,
    setupPinLogin,
    setupBiometricLogin,
    unlockWithPin,
    unlockWithBiometric,
    clearQuickLogin,
    isSetupForEmail,
  };
}
