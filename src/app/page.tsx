/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function HomePage() {
  const [name, setName] = useState(
    localStorage.getItem("image_to_code.name") ?? "",
  );
  const [base64, setBase64] = useState("");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const handleDownload = useCallback(() => {
    if (!contextRef.current) return;

    const ctx = contextRef.current;

    // Get the raw image data of the canvas
    const imageData = ctx.getImageData(0, 0, width, height);
    // Get a byte array of the image data
    const image_rgba = new Uint8Array(imageData.data.length);
    for (let i = 0; i < imageData.data.length; i++) {
      image_rgba[i] = imageData.data[i]!;
    }
    const image_16bit = convertImageToRGB565(image_rgba, width, height);

    const blob = new Blob([image_16bit], { type: "image/bin" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name + ".bin";
    a.click();
  }, [name, width, height]);

  const handleCopy = useCallback(() => {
    if (!contextRef.current) return;

    localStorage.setItem("image_to_code.name", name);

    const ctx = contextRef.current;

    // Get the raw image data of the canvas
    const imageData = ctx.getImageData(0, 0, width, height);
    // Get a byte array of the image data
    const image_rgba = new Uint8Array(imageData.data.length);
    for (let i = 0; i < imageData.data.length; i++) {
      image_rgba[i] = imageData.data[i]!;
    }
    const image_16bit = convertImageToRGB565(image_rgba, width, height);
    const code = generateCode(name, image_16bit);
    const blob = new Blob([code], { type: "text/plain" });
    const clipboardItem = new ClipboardItem({ "text/plain": blob });
    void navigator.clipboard.write([clipboardItem]);
  }, [height, name, width]);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile()!;
        const image = document.createElement("img");
        image.onload = () => {
          setWidth(image.width);
          setHeight(image.height);
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext("2d")!;
          contextRef.current = ctx;
          ctx.drawImage(image, 0, 0);
          const base64 = canvas.toDataURL("image/png");
          setBase64(base64);
        };
        // 将图片转换为base64
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64 = reader.result;
          image.src = base64 as string;
        };
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Image to C file
        </h1>
        <div>Paste a image and convert it to C code</div>
        <div>
          <img src={base64} alt="" />
        </div>
        <div>
          <input
            className="text-black"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </div>
        <div className="flex gap-4">
          <button onClick={handleDownload}>Download .bin</button>
          <button onClick={handleCopy}>Copy as C Code</button>
        </div>
      </div>
    </main>
  );
}

function convertImageToRGB565(
  image_32bit: Uint8Array,
  width: number,
  height: number,
) {
  const image_16bit = new Uint8Array(width * height * 2);
  for (let i = 0; i < image_32bit.length; i += 4) {
    const r = image_32bit[i]!;
    const g = image_32bit[i + 1]!;
    const b = image_32bit[i + 2]!;
    // const a = image_32bit[i + 3]!;
    const r5 = (r >> 3) & 0x1f;
    const g6 = (g >> 2) & 0x3f;
    const b5 = (b >> 3) & 0x1f;
    const rgb565 = (r5 << 11) | (g6 << 5) | b5;
    image_16bit[(i / 4) * 2] = (rgb565 & 0xff00) >> 8;
    image_16bit[(i / 4) * 2 + 1] = rgb565 & 0xff;
  }
  return image_16bit;
}

function generateCode(name: string, image_16bit: Uint8Array) {
  const code = `#pragma once\n\n#include <Arduino.h>\n#include <pgmspace.h>\n\nconst uint8_t ${name}_map[] PROGMEM = {
    ${Array.from(image_16bit)
      .map((v) => "0x" + v.toString(16).padStart(2, "0"))
      .join(", ")}
  };\n`;
  return code;
}
