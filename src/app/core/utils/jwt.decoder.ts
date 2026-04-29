/**
 * Utility to decode JWT tokens (client-side only, for debugging)
 * JWT has 3 parts: header.payload.signature
 * Only the payload is decoded here; signature is NOT verified
 */
export class JwtDecoder {
  static decode(token: string): any {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = parts[1];
      // Add padding if needed
      const padded = payload + '=='.substring(0, (4 - (payload.length % 4)) % 4);
      const decoded = atob(padded);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  }

  static getTokenInfo(token: string | null): {
    isValid: boolean;
    isExpired: boolean;
    claims: any;
    expiresAt: Date | null;
    role?: string;
    authorities?: string[];
  } {
    if (!token) {
      return { isValid: false, isExpired: false, claims: null, expiresAt: null };
    }

    const claims = this.decode(token);
    if (!claims) {
      return { isValid: false, isExpired: false, claims: null, expiresAt: null };
    }

    const expiresAt = claims.exp ? new Date(claims.exp * 1000) : null;
    const isExpired = expiresAt ? expiresAt < new Date() : false;
    const role = claims.role || claims.authorities?.[0];
    const authorities = claims.authorities || (claims.role ? [claims.role] : []);

    return {
      isValid: true,
      isExpired,
      claims,
      expiresAt,
      role,
      authorities,
    };
  }

  static logTokenInfo(label: string, token: string | null): void {
    const info = this.getTokenInfo(token);
    console.group(`🔍 JWT INFO: ${label}`);
    console.log('Valid:', info.isValid);
    console.log('Expired:', info.isExpired);
    console.log('Expires At:', info.expiresAt);
    console.log('Role:', info.role);
    console.log('Authorities:', info.authorities);
    console.log('Full Claims:', info.claims);
    console.groupEnd();
  }
}
