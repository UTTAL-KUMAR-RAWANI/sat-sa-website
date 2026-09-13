"use client";

import React, { useState, useEffect, useRef } from "react";

interface SpatialLayerProps {
    children: React.ReactNode;
    className?: string;
    maxTilt?: number; // max tilt in degrees (default 4)
    depth?: number; // subtle translation offset in px (default 10)
}

export default function SpatialLayer({
    children,
    className = "",
    maxTilt = 4,
    depth = 10,
}: SpatialLayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReducedMotion(mediaQuery.matches);

        const handleChange = () => setReducedMotion(mediaQuery.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (reducedMotion || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Normalized offsets from -1 to 1
        const deltaX = (e.clientX - centerX) / (rect.width / 2);
        const deltaY = (e.clientY - centerY) / (rect.height / 2);

        setTilt({
            x: Math.max(-1, Math.min(1, deltaX)),
            y: Math.max(-1, Math.min(1, deltaY)),
        });
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setTilt({ x: 0, y: 0 });
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    // Calculate rotation and translation
    const rotateX = reducedMotion ? 0 : -tilt.y * maxTilt;
    const rotateY = reducedMotion ? 0 : tilt.x * maxTilt;
    const transX = reducedMotion ? 0 : tilt.x * depth;
    const transY = reducedMotion ? 0 : tilt.y * depth;

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`perspective-1200 ${className}`}
        >
            <div
                className="preserve-3d transition-transform duration-300 ease-out will-change-transform h-full w-full"
                style={{
                    transform: isHovered
                        ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(${transX}px, ${transY}px, 0px)`
                        : "rotateX(0deg) rotateY(0deg) translate3d(0px, 0px, 0px)",
                }}
            >
                {children}
            </div>
        </div>
    );
}
