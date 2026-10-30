const express = require('express');
const jwt = require('jsonwebtoken');
const ldap = require('ldapjs');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Konfigurasi LDAP
const LDAP_URL = 'ldap://ldap.perusahaan.com:389';
const LDAP_BIND_DN = 'cn=admin,dc=perusahaan,dc=com';
const LDAP_BIND_PASSWORD = 'password_admin_ldap';
const LDAP_BASE_DN = 'ou=devices,dc=perusahaan,dc=com';

// Konfigurasi Talenta SSO (Secret/Public Key untuk verifikasi JWT)
const TALENTA_JWT_SECRET = 'rahasia_jwt_dari_talenta'; // atau public key RSA

// Helper untuk koneksi dan operasi write ke LDAP
function registerMacToLdap(macAddress, callback) {
    const client = ldap.createClient({ url: [LDAP_URL] });

    client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD, (err) => {
        if (err) {
            return callback(err);
        }

        // Format entry LDAP untuk device
        const entry = {
            objectClass: ['inetOrgPerson', 'top'],
            uid: macAddress,
            cn: macAddress,
            sn: 'WiFi-Device',
            userPassword: macAddress
        };

        const dn = `uid=${macAddress},${LDAP_BASE_DN}`;

        // Cek dulu apakah MAC sudah terdaftar, jika belum lakukan add, jika sudah lewati
        client.add(dn, entry, (addErr) => {
            client.unbind();
            if (addErr) {
                // Error 68 artinya entry sudah ada (EntryAlreadyExists), abaikan saja agar tetap sukses
                if (addErr.code === 68) {
                    return callback(null);
                }
                return callback(addErr);
            }
            return callback(null);
        });
    });
}

// Endpoint Callback yang diakses setelah login SSO Talenta sukses
// MikroTik meneruskan MAC address melalui parameter query (?mac=XX:XX:XX:XX:XX:XX)
app.get('/auth/callback', async (req, res) => {
    const macAddress = req.query.mac; // Tangkap MAC dari URL MikroTik
    const token = req.query.token;   // Tangkap JWT dari Talenta SSO

    if (!macAddress || !token) {
        return res.status(400).send('Parameter MAC Address atau Token JWT tidak ditemukan.');
    }

    try {
        // 1. Validasi keaslian JWT dari Talenta SSO
        const decoded = jwt.verify(token, TALENTA_JWT_SECRET);
        
        // (Opsional) Anda bisa mengecek status aktif pegawai di sini dari payload JWT
        console.log(`SSO Sukses untuk user: ${decoded.email}`);

        // Format MAC Address ke huruf kapital (standar yang dikirim MikroTik)
        const formattedMac = macAddress.toUpperCase();

        // 2. Daftarkan MAC Address ke LDAP
        registerMacToLdap(formattedMac, (ldapErr) => {
            if (ldapErr) {
                console.error('Gagal mendaftarkan ke LDAP:', ldapErr.message);
                return res.status(500).send('Terjadi kesalahan pada server direktori.');
            }

            console.log(`Perangkat dengan MAC ${formattedMac} berhasil didaftarkan ke LDAP.`);

            // 3. Redirect kembali ke MikroTik agar user langsung terkoneksi internet
            // Ubah IP di bawah ini dengan IP/Domain halaman login MikroTik Anda
            const mikrotikLoginUrl = `http://192.168.1.1/login?username=${formattedMac}&password=${formattedMac}`;
            return res.redirect(mikrotikLoginUrl);
        });

    } catch (jwtError) {
        console.error('JWT tidak valid:', jwtError.message);
        return res.status(401).send('Otentikasi Gagal: Token JWT tidak valid atau sudah kedaluwarsa.');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Middleware SSO berjalan di port ${PORT}`);
});
