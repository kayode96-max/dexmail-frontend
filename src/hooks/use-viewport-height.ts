'use client';

import { useEffect } from 'react';

/**
 * Hook to set CSS custom property for mobile viewport height
 * This accounts for mobile browser UI (address bar, toolbar)
 */
export function useViewportHeight() {
    useEffect(() => {
        // Function to set the viewport height
        const setVH = () => {
            // Get the viewport height and multiply by 1% to get a value for 1vh
            const vh = window.innerHeight * 0.01;
            // Set the value in the --vh custom property to the root of the document
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        // Set on mount
        setVH();

        // Update on resize and orientation change
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', setVH);

        // Cleanup
        return () => {
            window.removeEventListener('resize', setVH);
            window.removeEventListener('orientationchange', setVH);
        };
    }, []);
}
