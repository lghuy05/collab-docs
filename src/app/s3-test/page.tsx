"use client"

import { useState } from "react"

export default function S3TestPage() {
  const [img, setImg] = useState("");

  return (
    <div style={{ padding: 24 }}>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const res = await fetch("/api/uploads/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contentType: file.type,
              documentId: "test-doc",
            }),
          });

          const { uploadUrl, publicUrl } = await res.json();
          const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!put.ok) {
            alert("Upload failed");
            return;
          }
          setImg(publicUrl);

        }}
      />
      {img && <img src={img} style={{ maxWidth: 400, marginTop: 16 }} />}
    </div>
  )

}
