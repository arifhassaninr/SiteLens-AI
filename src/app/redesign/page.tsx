"use client";

import { ChangeEvent, useState } from "react";

type UploadedImage = { src: string; name: string };
type ImageSide = "before" | "after";

const MAX_IMAGE_MB = 8;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export default function RedesignPage() {
  const [before, setBefore] = useState<UploadedImage | null>(null);
  const [after, setAfter] = useState<UploadedImage | null>(null);
  const [split, setSplit] = useState(50);
  const [error, setError] = useState<string | null>(null);

  function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    side: ImageSide
  ) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    // Reset so selecting the same file again still triggers onChange.
    event.currentTarget.value = "";
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, GIF or WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image is too large. Please choose one under ${MAX_IMAGE_MB} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not read the image. Please try another one.");
        return;
      }
      const image = { src: reader.result, name: file.name };
      if (side === "before") setBefore(image);
      else setAfter(image);
    };
    reader.onerror = () => {
      setError("The browser could not read that file. Try a JPG or PNG image.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="extra-page">
      <a href="/">← Home</a>
      <h1>Before / After redesign</h1>
      <p>
        Choose two images from your computer and compare them. These images stay
        in your browser; they are not uploaded to a server, and no AI redesign
        is generated.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 28, marginBottom: 28 }}>
        <div className="extra-card">
          <label htmlFor="before-image" style={{ fontWeight: 800 }}>
            1. Before image
          </label>
          <input
            id="before-image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => handleImageUpload(event, "before")}
            style={{ display: "block", width: "100%", color: "#d7f7ee", colorScheme: "dark", cursor: "pointer" }}
          />
          <small>{before ? `Selected: ${before.name}` : "Select a JPG, PNG, WebP or GIF (up to 8 MB)."}</small>
          {before && <img src={before.src} alt="Before image preview" style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 10, background: "#091421" }} />}
        </div>
        <div className="extra-card">
          <label htmlFor="after-image" style={{ fontWeight: 800 }}>
            2. After image
          </label>
          <input
            id="after-image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => handleImageUpload(event, "after")}
            style={{ display: "block", width: "100%", color: "#d7f7ee", colorScheme: "dark", cursor: "pointer" }}
          />
          <small>{after ? `Selected: ${after.name}` : "Select a JPG, PNG, WebP or GIF (up to 8 MB)."}</small>
          {after && <img src={after.src} alt="After image preview" style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 10, background: "#091421" }} />}
        </div>
      </div>

      {error && (
        <p role="alert" style={{ padding: "12px 16px", border: "1px solid #a65965", background: "#45222a", borderRadius: 10, color: "#ffc5c9" }}>
          {error}
        </p>
      )}

      {before && after ? (
        <section aria-label="Image comparison">
          <h2>Compare your designs</h2>
          <div className="compare-frame" style={{ aspectRatio: "16 / 9", position: "relative", overflow: "hidden" }}>
            <img
              src={after.src}
              alt="After redesign"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <img
              src={before.src}
              alt="Before redesign"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `inset(0 ${100 - split}% 0 0)` }}
            />
            <div
              aria-hidden="true"
              style={{ position: "absolute", top: 0, bottom: 0, left: `${split}%`, width: 3, background: "white", boxShadow: "0 0 10px #0009", pointerEvents: "none" }}
            />
          </div>
          <label htmlFor="redesign-split" style={{ display: "block", marginTop: 18, fontWeight: 700 }}>
            Move the slider to compare
          </label>
          <input
            id="redesign-split"
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            style={{ display: "block", width: "100%", margin: "16px 0", accentColor: "#4ce0c0" }}
          />
          <p>Left: Before · Right: After</p>
        </section>
      ) : (
        <div className="extra-card">
          Select both a before image and an after image to see the comparison.
        </div>
      )}
    </main>
  );
}
