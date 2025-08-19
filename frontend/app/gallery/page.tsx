"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import ImageGallery, { ReactImageGalleryItem } from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

type ApiResponse = {
    images: string[];
    hasMore: boolean;
};

export default function GroupGallery() {
    const searchParams = useSearchParams();
    const groupId = searchParams.get("groupId");

    const [isOpen, setIsOpen] = useState(false);
    const [startIndex, setStartIndex] = useState(0);
    const [images, setImages] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

    const loaderRef = useRef<HTMLDivElement | null>(null);

    // ✅ Enhanced caching system
    const cache = useRef<{
        pages: Map<string, string[]>;
        allImages: Map<string, string[]>; // Cache all images by groupId
        loadingStates: Map<string, boolean>;
    }>({
        pages: new Map(),
        allImages: new Map(),
        loadingStates: new Map()
    });

    // ✅ Preload images to avoid loading states in carousel
    const preloadImage = useCallback((src: string) => {
        if (loadedImages.has(src)) return Promise.resolve();

        return new Promise<void>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                setLoadedImages(prev => new Set(prev).add(src));
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }, [loadedImages]);

    const fetchImages = useCallback(async () => {
        if (!groupId || !hasMore || loading) return;

        const requestKey = `${groupId}-${page}`;

        // Check if this exact request is already loading
        if (cache.current.loadingStates.get(requestKey)) return;

        setLoading(true);
        cache.current.loadingStates.set(requestKey, true);

        // Check page cache first
        const cacheKey = `${groupId}-${page}`;
        if (cache.current.pages.has(cacheKey)) {
            const cachedImages = cache.current.pages.get(cacheKey) || [];
            setImages((prev) => [...prev, ...cachedImages]);
            setPage((prev) => prev + 1);
            setLoading(false);
            cache.current.loadingStates.set(requestKey, false);

            // Preload these images in background
            cachedImages.forEach(src => preloadImage(src));
            return;
        }

        try {
            const res = await fetch(
                `/api/groups/images?groupId=${groupId}&page=${page}`
            );
            const data: ApiResponse = await res.json();

            // Cache the page result
            cache.current.pages.set(cacheKey, data.images);

            // Update all images cache
            const currentAllImages = cache.current.allImages.get(groupId) || [];
            const updatedAllImages = [...currentAllImages, ...data.images];
            cache.current.allImages.set(groupId, updatedAllImages);

            setImages((prev) => [...prev, ...data.images]);
            setHasMore(data.hasMore);
            setPage((prev) => prev + 1);

            // Preload new images in background
            data.images.forEach(src => preloadImage(src));

        } catch (err) {
            console.error("Failed to fetch images", err);
        } finally {
            setLoading(false);
            cache.current.loadingStates.set(requestKey, false);
        }
    }, [groupId, page, hasMore, loading, preloadImage]);

    // ✅ Initialize from cache if available
    useEffect(() => {
        if (groupId && cache.current.allImages.has(groupId)) {
            const cachedImages = cache.current.allImages.get(groupId) || [];
            if (cachedImages.length > 0) {
                setImages(cachedImages);
                // Calculate how many pages we already have
                const pagesLoaded = Math.ceil(cachedImages.length / 20); // Assuming 20 images per page
                setPage(pagesLoaded);
            }
        }
    }, [groupId]);

    // ✅ Infinite scroll observer with debouncing
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loading) {
                    // Debounce to prevent multiple rapid calls
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        fetchImages();
                    }, 100);
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => {
            clearTimeout(timeoutId);
            if (loaderRef.current) observer.unobserve(loaderRef.current);
        };
    }, [fetchImages, loading]);

    // ✅ Keyboard support for closing with Esc
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEsc);
            // Prevent body scrolling when carousel is open
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener("keydown", handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // ✅ Preload images when carousel is about to open
    const handleImageClick = useCallback(async (idx: number) => {
        setStartIndex(idx);
        setIsOpen(true);

        // Preload current and nearby images
        const indicesToPreload = [
            idx - 2, idx - 1, idx, idx + 1, idx + 2
        ].filter(i => i >= 0 && i < images.length);

        indicesToPreload.forEach(i => {
            preloadImage(images[i]);
        });
    }, [images, preloadImage]);

    if (!groupId) return <p>No groupId provided in URL</p>;

    // ✅ Enhanced gallery items with better loading handling
    const galleryItems: ReactImageGalleryItem[] = useMemo(
        () =>
            images.map((src) => ({
                original: src,
                thumbnail: src,
                loading: "lazy" as const,
                originalClass: "object-contain bg-black max-h-full w-auto mx-auto",
                thumbnailClass: "object-cover",
                originalAlt: "Gallery image",
                thumbnailAlt: "Gallery thumbnail",
            })),
        [images]
    );

    return (
        <>
            {/* ✅ Responsive Masonry-like Grid */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {images.map((src, idx) => (
                    <div
                        key={`${src}-${idx}`} // Better key to handle duplicate images
                        className="relative aspect-square cursor-pointer overflow-hidden rounded-lg shadow-md bg-gray-200"
                        onClick={() => handleImageClick(idx)}
                    >
                        <Image
                            src={src}
                            alt={`group image ${idx}`}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16.67vw"
                            className="object-cover object-top hover:scale-105 transition-transform duration-300"
                            priority={idx < 12} // ✅ Preload more images for better UX
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                        />
                    </div>
                ))}
            </div>

            {loading && (
                <div className="text-center py-8">
                    <div className="inline-flex items-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                        Loading more images...
                    </div>
                </div>
            )}

            {!hasMore && images.length > 0 && (
                <p className="text-center py-4 text-gray-500">No more images to load</p>
            )}

            {/* Infinite scroll trigger */}
            <div ref={loaderRef} className="h-10"></div>

            {/* ✅ Fixed Fullscreen Carousel with better positioning */}
            {isOpen && (
                <div className="fixed inset-0 bg-black z-50">
                    {/* Close button */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-4 right-4 z-50 text-white text-3xl hover:text-gray-300 transition-colors duration-200 bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center"
                        aria-label="Close gallery"
                    >
                        ×
                    </button>

                    {/* Image counter */}
                    <div className="absolute top-4 left-4 z-50 text-white bg-black bg-opacity-50 px-3 py-1 rounded">
                        {startIndex + 1} / {images.length}
                    </div>

                    {/* ✅ Fixed carousel container with proper height calculation */}
                    <div className="h-full flex flex-col">
                        <div className="flex-1 relative">
                            <ImageGallery
                                items={galleryItems}
                                startIndex={startIndex}
                                showThumbnails={true}
                                showFullscreenButton={false}
                                showPlayButton={false}
                                showBullets={false}
                                lazyLoad={false} // ✅ Disable lazy loading since we preload
                                showNav={true}
                                slideDuration={300}
                                slideInterval={0}
                                thumbnailPosition="bottom"
                                onSlide={(index) => {
                                    // Preload nearby images when sliding
                                    const indicesToPreload = [
                                        index - 1, index, index + 1
                                    ].filter(i => i >= 0 && i < images.length);

                                    indicesToPreload.forEach(i => {
                                        preloadImage(images[i]);
                                    });
                                }}
                                additionalClass="gallery-container"
                                renderItem={(item) => (
                                    <div className="image-gallery-image">
                                        <img
                                            src={item.original}
                                            alt={item.originalAlt || ""}
                                            className="object-contain max-h-full max-w-full mx-auto"
                                            style={{
                                                maxHeight: 'calc(100vh - 120px)', // ✅ Reserve space for thumbnails
                                                width: 'auto',
                                                height: 'auto'
                                            }}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                </div>
            )}


        </>
    );
}