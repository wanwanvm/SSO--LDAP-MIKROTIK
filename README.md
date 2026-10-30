# 🚀 Integrasi SSO Talenta, Middleware Node.js, FreeRADIUS, LDAP, & MikroTik

Repositori ini berisi dokumentasi dan panduan arsitektur untuk mengintegrasikan **SSO Talenta** dengan **MikroTik Hotspot** menggunakan **Middleware Node.js**, **FreeRADIUS**, dan **Server LDAP (Active Directory / OpenLDAP)** guna mengotomatisasi autentikasi jaringan secara transparan (*MAC Authentication*).

---

## 🏗️ Arsitektur & Alur Kerja (*Workflow*)

Diagram di bawah ini menggambarkan alur kerja sistem dari saat perangkat terhubung ke Wi-Fi hingga mendapatkan akses internet secara otomatis:

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (Karyawan)
    participant MT as MikroTik Hotspot
    participant MW as Server Middleware (Node.js)
    participant SSO as SSO Talenta
    participant LDAP as Server LDAP
    participant FR as FreeRADIUS Server

    Note over User, FR: Tahap 1: Koneksi Awal & Intersepsi Captive Portal
    User->>MT: Terhubung ke Wi-Fi / Buka Browser
    MT->>User: Redirect ke login.html (membawa makro $(mac))
    User->>MW: login.html otomatis redirect ke /auth/callback?mac=XX:XX...

    Note over User, FR: Tahap 2: Autentikasi SSO Talenta & Validasi JWT
    MW->>User: Arahkan ke Halaman Login SSO Talenta
    User->>SSO: Masukkan Kredensial SSO Perusahaan
    SSO->>MW: Callback dengan membawa Token JWT
    MW->>MW: Verifikasi Keaslian Token JWT (Secret/Public Key)

    Note over User, FR: Tahap 3: Pendaftaran Perangkat ke LDAP
    alt JWT Valid
        MW->>LDAP: Daftarkan MAC Address (uid & userPassword = MAC) ke ou=devices
        LDAP-->>MW: Konfirmasi Sukses Penambahan Data Device
        MW->>MT: Redirect kembali ke URL Login MikroTik (/login?username=MAC&password=MAC)
    else JWT Tidak Valid
        MW-->>User: Tampilkan Pesan Error (Unauthorized)
    end

    Note over User, FR: Tahap 4: Otentikasi Jaringan via MAC Auth & RADIUS
    MT->>FR: Kirim Access-Request (Username=MAC, Password=MAC)
    FR->>LDAP: Bind & Cari Query berdasarkan MAC Address (uid)
    LDAP-->>FR: Return Data Ditemukan (Access-Accept)
    FR-->>MT: Kirim Balasan Access-Accept
    MT->>User: Berikan Akses Internet Penuh (Bypass Captive Portal)
