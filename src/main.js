// src/main.js
import { config } from './config.js';
import './style.css';

const feedContainer = document.getElementById('feed-container');
const toastEl = document.getElementById('toast');
const edgeLeft = document.getElementById('edge-zone-left');
const edgeRight = document.getElementById('edge-zone-right');

// Dev Panel Elements
const devInfo = document.getElementById('dev-info');
const devLog = document.getElementById('dev-log');

let currentIndex = 0;
let isScrolling = false;
let scrollTimeout = null;

function logDev(msg) {
    devLog.textContent = msg;
    console.log('[Dev]', msg);
    // Auto clear after 2s
    setTimeout(() => { if (devLog.textContent === msg) devLog.textContent = '-'; }, 3000);
}

function updateDevInfo() {
    const item = config.playables[currentIndex];
    devInfo.innerHTML = `Idx: ${currentIndex} <br> ID: ${item?.id} <br> Path: ${item?.path}`;
}

const loadingOverlay = document.getElementById('loading-overlay');

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// Initialize Feed
function init() {
    config.playables.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'playable-wrapper';
        wrapper.dataset.index = index;

        const iframe = document.createElement('iframe');
        iframe.className = 'playable-iframe';
        // Load first item immediately, others lazy? or just load all for simplicity in demo
        // Requirement says preload next/prev. For 3 items, just load all is fine but let's be nice.
        if (index === 0) {
            iframe.src = item.path;
            showLoading(); // Show initial load
        } else {
            iframe.dataset.src = item.path; // Lazy
        }

        // Security & Permissions
        // "allow" attributes as requested
        iframe.allow = "autoplay; fullscreen; clipboard-read; clipboard-write; gamepad; accelerometer; gyroscope";
        // No sandbox, as requested

        iframe.onload = () => {
            logDev(`Loaded: ${item.id}`);
            if (index === currentIndex) hideLoading();
        };
        iframe.onerror = (e) => {
            logDev(`Error: ${item.id}`);
            console.error('Iframe Error', e);
            if (index === currentIndex) hideLoading(); // Hide on error too
        };

        wrapper.appendChild(iframe);
        feedContainer.appendChild(wrapper);
    });

    // Initial load logic if needed
    loadNearbyIframes(0);
    updateDevInfo();

    // Attach edge listeners
    attachEdgeListeners();
}

// Lazy Loading / Preloading
function loadNearbyIframes(index) {
    const indicesToLoad = [index, index + 1, index - 1];
    const wrappers = document.querySelectorAll('.playable-wrapper');

    indicesToLoad.forEach(i => {
        if (i >= 0 && i < wrappers.length) {
            const iframe = wrappers[i].querySelector('iframe');
            if (iframe && !iframe.src && iframe.dataset.src) {
                iframe.src = iframe.dataset.src;
                logDev(`Preloading: ${i}`);
            }
        }
    });
}

// Scroll Snap Detection
feedContainer.addEventListener('scroll', () => {
    // Debounce/Throttle index calculation
    if (scrollTimeout) clearTimeout(scrollTimeout);

    scrollTimeout = setTimeout(() => {
        const height = feedContainer.clientHeight;
        const scrollPos = feedContainer.scrollTop;
        const newIndex = Math.round(scrollPos / height);

        if (newIndex !== currentIndex) {
            currentIndex = newIndex;
            updateDevInfo();
            showLoading(); // Show when switching, will hide if already loaded or when distinct load event fires
            // Optimization: check if iframe is already loaded? 
            // For now, simple toggle is safer.

            // Check if ready state is complete? 
            const currentFrame = document.querySelector(`.playable-wrapper[data-index="${currentIndex}"] iframe`);
            // If src is already set and loaded, hide immediately.
            // But we don't track "loaded" state easily. Let's rely on the load event or timeout.
            // Actually, if it was preloaded, onload fired long ago.
            // Simple fix: hide loading after a short grace period if preloaded.
            setTimeout(() => hideLoading(), 500);

            loadNearbyIframes(newIndex);
        }
    }, 50);
});

// Toast Helper
function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    void toastEl.offsetWidth;
    toastEl.classList.add('visible');

    setTimeout(() => {
        toastEl.classList.remove('visible');
        setTimeout(() => {
            toastEl.classList.add('hidden');
        }, 300);
    }, 2000);
}

// Edge Swipe Logic
function attachEdgeListeners() {
    [edgeLeft, edgeRight].forEach(zone => {
        zone.addEventListener('mousedown', onPointerDown);
        zone.addEventListener('touchstart', onPointerDown, { passive: false });
    });

    // Global up/move listeners to capture drags that start in zone but move out
    // Actually, it's cleaner to attach move/up to document once down is triggered in zone.
}

let startX = 0;
let startY = 0;
let isDragging = false;
let activeZone = null;

function onPointerDown(e) {
    // Only left button/touch
    isDragging = true;
    activeZone = e.target;

    if (e.touches && e.touches.length > 0) {
        startX = e.touches[0].screenX;
        startY = e.touches[0].screenY;
    } else {
        startX = e.screenX || e.clientX;
        startY = e.screenY || e.clientY;
    }

    // Add document listeners for move/up
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
}

function onPointerMove(e) {
    if (!isDragging) return;
    // Optional: Prevent default to stop scrolling while swiping edges?
    // e.preventDefault(); 
}

function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    let endX = 0;
    let endY = 0;

    if (e.changedTouches && e.changedTouches.length > 0) {
        endX = e.changedTouches[0].screenX;
        endY = e.changedTouches[0].screenY;
    } else {
        endX = e.screenX || e.clientX;
        endY = e.screenY || e.clientY;
    }

    const dx = endX - startX;
    const dy = endY - startY;

    handleSwipe(dx, dy);

    // Cleanup
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);
}

function handleSwipe(dx, dy) {
    // Threshold: 60px, Horiz > Vert
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        if (dx > 0) {
            // Swipe RIGHT
            const item = config.playables[currentIndex];
            showToast("Opening App Store...");
            window.open(item.storeUrl, '_blank');
        } else {
            // Swipe LEFT
            showToast("Not interested");
            // Auto advance after 900ms
            setTimeout(() => {
                scrollToIndex(currentIndex + 1);
            }, 900);
        }
    }
}

function scrollToIndex(index) {
    if (index >= 0 && index < config.playables.length) {
        const height = feedContainer.clientHeight;
        feedContainer.scrollTo({
            top: index * height,
            behavior: 'smooth'
        });
    }
}

init();
