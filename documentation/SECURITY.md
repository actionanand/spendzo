# Security and privacy

Spendzo is offline-first and does not include accounts, analytics, advertisements, telemetry, or
trackers. Browser data is stored in IndexedDB. Android data is stored in a private SQLite database.

PINs are never stored as plaintext. The browser-side verifier uses PBKDF2-SHA-256 with a random
128-bit salt and 210,000 iterations. Comparison avoids data-dependent early exits. Backups omit
the PIN salt, verifier, iteration count, biometric preference, and Android Keystore data.

On Android, enabling fingerprint unlock creates an AES-GCM key in Android Keystore that requires
strong biometric authentication. The encrypted verifier and IV are stored in private app
preferences. Biometric enrollment changes invalidate the key. Fingerprint unlock always retains
PIN fallback, and removing the PIN deletes the biometric key and encrypted material.

There is no PIN recovery. The settings interface warns users before enabling or changing a PIN.
Users should retain current backups. Backups themselves are intentionally unencrypted and must be
handled as readable financial data.
