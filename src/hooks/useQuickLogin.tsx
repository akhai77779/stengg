import { useState, useEffect, useCallback } from 'react';
import {
  deriveKeyFromPin,
  encryptData,
  decryptData,
  generateSalt,
  bufferToBase64,
  base64ToBuffer,
  generateRandomKey,
  exportKey,
  importKey,
} from '@/lib/crypto';

interface StoredCredentials {
  email: string;
  encryptedPassword: string;
  salt: string;
  method: 'pin' | 'biometric';
  biometricKeyId?: string;
  biometricKey?: string;
  createdAt: string;
}

interface QuickLoginState {
  isAvailable: boolean;
  method: 'pin' | 'biometric' | null;
  email: string | null;
}

const STORAGE_KEY = 'quickLoginCredentials';

export function useQuickLogin() {
  const [state, setState] = useState<QuickLoginState>({
    isAvailable: false,
    method: null,
    email: null,
  });
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  // Check for stored credentials and biometric support
  useEffect(() => {
    checkStoredCredentials();
    checkBiometricSupport();
  }, []);

  const checkStoredCredentials = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const credentials: StoredCredentials = JSON.parse(stored);
        setState({
          isAvailable: true,
          method: credentials.method,
          email: credentials.email,
        });
      }
    } catch (e) {
      console.error('Error checking stored credentials:', e);
    }
  };

  const checkBiometricSupport = async () => {
    try {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setIsBiometricSupported(available);
      }
    } catch (e) {
      console.error('Error checking biometric support:', e);
      setIsBiometricSupported(false);
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
   * Setup biometric quick login
   */
  const setupBiometricLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      if (!isBiometricSupported) {
        throw new Error('Biometric authentication not supported');
      }

      // Generate a random key for encryption
      const encryptionKey = await generateRandomKey();
      const exportedKey = await exportKey(encryptionKey);
      
      // Create WebAuthn credential
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = new TextEncoder().encode(email);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'ST Engineering',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: email,
            displayName: email,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Encrypt password with the random key
      const encryptedPassword = await encryptData(password, encryptionKey);
      const salt = generateSalt();

      const credentials: StoredCredentials = {
        email,
        encryptedPassword,
        salt: bufferToBase64(salt),
        method: 'biometric',
        biometricKeyId: credential.id,
        biometricKey: exportedKey,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
      
      setState({
        isAvailable: true,
        method: 'biometric',
        email,
      });

      return true;
    } catch (e) {
      console.error('Error setting up biometric login:', e);
      return false;
    }
  }, [isBiometricSupported]);

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
   * Unlock with biometric and get credentials
   */
  const unlockWithBiometric = useCallback(async (): Promise<{ email: string; password: string } | null> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const credentials: StoredCredentials = JSON.parse(stored);
      if (credentials.method !== 'biometric' || !credentials.biometricKeyId || !credentials.biometricKey) {
        return null;
      }

      // Verify biometric
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credentialId = base64ToBuffer(credentials.biometricKeyId);
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: credentialId.buffer as ArrayBuffer,
            type: 'public-key',
          }],
          userVerification: 'required',
          timeout: 60000,
        },
      });

      if (!assertion) {
        throw new Error('Biometric verification failed');
      }

      // Decrypt password
      const encryptionKey = await importKey(credentials.biometricKey);
      const password = await decryptData(credentials.encryptedPassword, encryptionKey);

      return { email: credentials.email, password };
    } catch (e) {
      console.error('Error unlocking with biometric:', e);
      return null;
    }
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
