import { Platform } from 'react-native';

// Polyfills para PouchDB e outras libs que dependem de globais do Node/Browser antigo
if (typeof global === 'undefined') {
    window.global = window;
}
if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.global = window;
    window.process = {
        env: { NODE_ENV: 'production' },
        nextTick: (cb) => setTimeout(cb, 0)
    };
}

import 'expo-router/entry';