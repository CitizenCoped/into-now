"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useLivePresence } from "@/hooks/useLivePresence";
import type { Post } from "@/lib/schema";
import PostModal from "./PostModal";
import PostSidebar from "./PostSidebar";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const { liveUsers, myLocation, connected, sharing } = useLivePresence();

  const fetchPosts = useCallback(async (term?: string) => {
    const params = new URLSearchParams();
    if (term) params.set("search", term);
    const res = await fetch(`/api/posts?${params}`);
    const data = await res.json();
    setPosts(data.posts ?? []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPosts(search), 250);
    return () => clearTimeout(timer);
  }, [search, fetchPosts]);

  useEffect(() => {
    if (myLocation) {
      setCenter(myLocation);
    }
  }, [myLocation]);

  function handlePostClick(post: Post) {
    setSelectedId(post.id);
    setCenter({ lat: post.lat, lng: post.lng });
    setZoom(15);
  }

  async function handleCreatePost(data: {
    title: string;
    description: string;
    category: string;
    lat: number;
    lng: number;
  }) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create post");
    await fetchPosts(search);
    setSelectedId((await res.json()).post?.id ?? null);
  }

  const postLat = myLocation?.lat ?? center.lat;
  const postLng = myLocation?.lng ?? center.lng;

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#06040c]">
      <MapView
        posts={posts}
        liveUsers={liveUsers}
        myLocation={myLocation}
        center={center}
        zoom={zoom}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <PostSidebar
        posts={posts}
        search={search}
        onSearchChange={setSearch}
        onPostClick={handlePostClick}
        onNewPost={() => setModalOpen(true)}
        selectedId={selectedId}
        liveCount={liveUsers.length}
        connected={connected}
        sharing={sharing}
      />
      <PostModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreatePost}
        defaultLat={postLat}
        defaultLng={postLng}
      />
    </main>
  );
}