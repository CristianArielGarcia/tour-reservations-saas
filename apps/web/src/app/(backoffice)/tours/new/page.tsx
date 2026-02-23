"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewTourPage() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to tours list - creation is handled via modal
    router.replace("/tours");
  }, [router]);
  return null;
}
