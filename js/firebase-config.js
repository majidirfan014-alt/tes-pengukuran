// =====================================================================
// firebase-config.js — Konfigurasi Firebase (proyek: tespengukuran-bb50b)
// Dipakai oleh js/sync.js untuk sinkronisasi localStorage <-> Firestore.
// Catatan: konfigurasi web Firebase memang bersifat publik di sisi klien;
// keamanan data sepenuhnya ditentukan oleh Firestore Security Rules.
// =====================================================================
'use strict';

var firebaseConfig = {
    apiKey: 'AIzaSyD_CSZqnh2YaNXdnAazxunVegiqMkxK9TM',
    authDomain: 'tespengukuran-bb50b.firebaseapp.com',
    projectId: 'tespengukuran-bb50b',
    storageBucket: 'tespengukuran-bb50b.firebasestorage.app',
    messagingSenderId: '591400583993',
    appId: '1:591400583993:web:ab20b02fb2eee957761ee8',
    measurementId: 'G-XP21F1W3Q8'
};

// Inisialisasi satu kali; SDK compat harus sudah dimuat sebelum file ini.
if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
