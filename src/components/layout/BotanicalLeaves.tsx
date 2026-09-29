import React from 'react';

export function BotanicalLeaves() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* Top Left Leaf Cluster */}
      <svg
        className="botanical-leaf-svg absolute -top-12 -left-12 w-80 h-80 hidden sm:block transition-all duration-300"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 0C50 40 10 90 0 160C50 170 120 150 160 100C190 50 160 10 100 0Z"
          fill="currentColor"
        />
        <path
          d="M30 140C70 110 120 70 160 30"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M70 105C90 120 110 135 130 150"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Top Right Leaf Cluster */}
      <svg
        className="botanical-leaf-svg absolute top-10 -right-16 w-96 h-96 transition-all duration-300"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 200C150 160 190 110 200 40C150 30 80 50 40 100C10 150 40 190 100 200Z"
          fill="currentColor"
        />
        <path
          d="M170 60C130 90 80 130 40 170"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M130 95C110 80 90 65 70 50"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Middle Left Leaf */}
      <svg
        className="botanical-leaf-svg absolute top-[45%] -left-20 w-88 h-88 hidden lg:block transition-all duration-300"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M200 100C150 140 100 180 20 160C30 100 70 40 130 20C180 10 200 50 200 100Z"
          fill="currentColor"
        />
        <path
          d="M40 140C80 110 130 80 170 30"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      {/* Bottom Right Floating Leaf (near Poupagaio area) */}
      <svg
        className="botanical-leaf-svg absolute bottom-12 -right-10 w-80 h-80 transition-all duration-300"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 100C40 50 90 10 160 0C170 50 150 120 100 160C50 190 10 160 0 100Z"
          fill="currentColor"
        />
        <path
          d="M140 30C110 70 70 120 30 160"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
