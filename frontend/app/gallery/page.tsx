"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import ImageGallery, { ReactImageGalleryItem } from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";


type ImageItem = {
    id: string;
    compressed_location: string;
    filename: string;
    original_location: string;// already used in UI
};

type ApiResponse = {
    images: ImageItem[];
    hasMore: boolean;
};

export default function GroupGallery() {
    const searchParams = useSearchParams();
    const groupId = searchParams.get("groupId");

    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [images, setImages] = useState<ImageItem[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const LOAD_MORE_AHEAD = 5;
    const loaderRef = useRef<HTMLDivElement | null>(null);

    // ✅ Use refs for cache + preloaded images (no re-render)
    const loadedImagesRef = useRef<Set<string>>(new Set());
    const cache = useRef<{
        pages: Map<string, string[]>;
        allImages: Map<string, string[]>;
        loadingStates: Map<string, boolean>;
    }>({
        pages: new Map(),
        allImages: new Map(),
        loadingStates: new Map(),
    });

    // ✅ Preload image without re-render
    const preloadImage = useCallback((src: string) => {
        if (loadedImagesRef.current.has(src)) return Promise.resolve();

        return new Promise<void>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                loadedImagesRef.current.add(src);
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }, []);

    // ✅ Fetch images with caching
    const fetchImages = useCallback(async () => {
        if (!groupId || !hasMore || loading) return;

        const requestKey = `${groupId}-${page}`;

        setLoading(true);

        try {
            const res = await fetch(`/api/groups/images?groupId=${groupId}&page=${page}`);
            const data: ApiResponse = await res.json();

            setImages((prev) => [...prev, ...data.images]);
            setHasMore(data.hasMore);
            setPage((prev) => prev + 1);

            data.images.forEach((image) => preloadImage(image.compressed_location));
        } catch (err) {
            console.error("Failed to fetch images", err);
        } finally {
            setLoading(false);
            cache.current.loadingStates.set(requestKey, false);
        }
    }, [groupId, page, hasMore, loading, preloadImage]);

    // Helper function to download from Firebase URL with CORS handling
    const downloadFromFirebaseUrl = useCallback(async (url: string, filename: string) => {
        try {
            // Try to use a simple anchor tag approach first
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.target = "_blank";

            // Add to DOM temporarily
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error("Failed to download image:", err);
            alert("Failed to download image. The image will open in a new tab instead.");
            window.open(url, '_blank');
        }
    }, []);

    // Download compressed image via backend proxy
    const downloadCompressed = useCallback(async () => {
        try {
            const response = await fetch('/api/images/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: 'compressed_' + images[currentIndex].id,
                })
            });

            const { downloadUrl } = await response.json();

            // Fetch the actual file as blob
            const fileResp = await fetch(downloadUrl);
            const blob = await fileResp.blob();
            const url = window.URL.createObjectURL(blob);

            // Trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = images[currentIndex].filename || "image.jpg";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    }, [images, currentIndex]);

    // Download original image via backend proxy
    const downloadOriginal = useCallback(async () => {
        try {
            const response = await fetch('/api/images/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: images[currentIndex].id,
                })
            });

            const { downloadUrl } = await response.json();

            // Fetch the actual file as blob
            const fileResp = await fetch(downloadUrl);
            const blob = await fileResp.blob();
            const url = window.URL.createObjectURL(blob);

            // Trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = images[currentIndex].filename || "image.jpg";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    }, [images, currentIndex]);


    // ✅ Infinite scroll observer
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loading) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => fetchImages(), 100);
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

    // ✅ Close on Esc
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEsc);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleEsc);
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // ✅ Click handler to open carousel
    const handleImageClick = useCallback(
        (idx: number) => {
            setCurrentIndex(idx);
            setIsOpen(true);

            const indicesToPreload = [idx - 2, idx - 1, idx, idx + 1, idx + 2].filter(
                (i) => i >= 0 && i < images.length
            );
            indicesToPreload.forEach((i) => preloadImage(images[i].compressed_location));

            if (images.length - idx <= LOAD_MORE_AHEAD && hasMore && !loading) {
                fetchImages();
            }
        },
        [images, hasMore, loading, preloadImage, fetchImages]
    );

    if (!groupId) return <p>No groupId provided in URL</p>;

    // ✅ Stable gallery items
    const galleryItems: ReactImageGalleryItem[] = useMemo(
        () =>
            images.map((image) => ({
                original: image.original_location,
                thumbnail: image.compressed_location,
                loading: "lazy" as const,
                originalAlt: "Gallery image",
                thumbnailAlt: "Gallery thumbnail",
            })),
        [images]
    );

    return (
        <>
            {/* Grid */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {images.map((image, idx) => (
                    <div
                        key={`${image.compressed_location}-${idx}`}
                        className="relative aspect-square cursor-pointer overflow-hidden rounded-lg shadow-md bg-gray-200"
                        onClick={() => handleImageClick(idx)}
                    >
                        <Image
                            src={image.compressed_location}
                            alt={`group image ${idx}`}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16.67vw"
                            className="object-cover object-top hover:scale-105 transition-transform duration-300"
                            priority={idx < 12}
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

            {/* Fullscreen carousel */}
            {isOpen && (
                <div className="fixed inset-0 bg-black z-50">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-4 right-4 z-50 text-white text-3xl hover:text-gray-300 transition-colors duration-200 bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center"
                        aria-label="Close gallery"
                    >
                        ×
                    </button>

                    <div className="absolute top-4 left-4 z-50 text-white bg-black bg-opacity-50 px-3 py-1 rounded">
                        {currentIndex + 1} / {images.length}
                    </div>

                    {/* Download buttons positioned in bottom right */}
                    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
                        <button
                            onClick={downloadCompressed}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors duration-200 shadow-lg"
                        >
                            Download Compressed
                        </button>
                        <button
                            onClick={downloadOriginal}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition-colors duration-200 shadow-lg"
                        >
                            Download Original
                        </button>
                    </div>

                    <div className="h-full flex flex-col">
                        <div className="flex-1 relative">
                            <ImageGallery
                                items={galleryItems}
                                startIndex={currentIndex}
                                showThumbnails={false}
                                showFullscreenButton={false}
                                showPlayButton={false}
                                showBullets={false}
                                lazyLoad={false}
                                showNav={true}
                                slideDuration={300}
                                slideInterval={0}
                                onSlide={(index) => {
                                    setCurrentIndex(index);
                                    const indicesToPreload = [index - 1, index, index + 1].filter(
                                        (i) => i >= 0 && i < images.length
                                    );
                                    if (images.length - index <= LOAD_MORE_AHEAD && hasMore && !loading) {
                                        fetchImages();
                                    }
                                    indicesToPreload.forEach((i) => preloadImage(images[i].compressed_location));
                                }}
                                renderItem={(item) => (
                                    <div className="image-gallery-image relative h-screen w-screen flex items-center justify-center">
                                        <Image
                                            src={item.original}
                                            alt={item.originalAlt || ""}
                                            fill
                                            className="object-contain"
                                            priority={false}
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