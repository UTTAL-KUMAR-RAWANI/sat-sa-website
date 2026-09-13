"use client";

import React from "react";
import Image from "next/image";

export interface BrandLogoProps {
    /** Preset size variant */
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
    /** Additional classes for the container */
    className?: string;
    /** Additional classes for the image */
    imageClassName?: string;
    /** Next.js Image priority loading */
    priority?: boolean;
    /** Whether to render the outer framed badge container (default true) */
    withContainer?: boolean;
}

/**
 * Proportional dimensions maintaining the exact 272:291 (~0.9347) aspect ratio
 * of official `logo v7.png` with comfortable badge padding to prevent clipping.
 */
const SIZE_CONFIGS = {
    xs: {
        container: "h-7 w-7 rounded-lg p-1",
        width: 19,
        height: 20,
    },
    sm: {
        container: "h-8 w-8 rounded-lg p-1",
        width: 22,
        height: 24,
    },
    md: {
        container: "h-10 w-10 rounded-xl p-1.5",
        width: 26,
        height: 28,
    },
    lg: {
        container: "h-12 w-12 rounded-2xl p-1.5",
        width: 34,
        height: 36,
    },
    xl: {
        container: "h-16 w-16 rounded-2xl p-2",
        width: 47,
        height: 50,
    },
    "2xl": {
        container: "h-20 w-20 rounded-3xl p-2.5",
        width: 60,
        height: 64,
    },
};

/**
 * Reusable official SAT-SA brand logo component.
 * Uses the supplied official `logo v7.png` asset with transparent background,
 * preserving natural proportions, cyan/teal colors, and orbit details without clipping.
 */
export default function BrandLogo({
    size = "md",
    className = "",
    imageClassName = "",
    priority = false,
    withContainer = true,
}: BrandLogoProps) {
    const config = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

    const img = (
        <Image
            src="/logo v7.png"
            alt="SAT-SA Platform Logo"
            width={config.width}
            height={config.height}
            priority={priority}
            className={`object-contain select-none shrink-0 transition-transform ${imageClassName}`}
            style={{ width: `${config.width}px`, height: `${config.height}px` }}
        />
    );

    if (!withContainer) {
        return img;
    }

    return (
        <div
            className={`relative flex items-center justify-center shrink-0 bg-slate-900/90 border border-slate-800 shadow-md shadow-emerald-500/10 ${config.container} ${className}`}
        >
            {img}
        </div>
    );
}
