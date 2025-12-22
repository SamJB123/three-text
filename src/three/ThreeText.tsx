/// <reference types="@react-three/fiber" />
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Text as ThreeText } from './index';
import type {
  TextOptions,
  ThreeTextGeometryInfo as TextGeometryInfo
} from './index';

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // Arrays (common in options like color, byCharRange, etc.)
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

function useDeepCompareMemo<T>(value: T): T {
  const ref = useRef<T>(value);

  if (!deepEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
}

export interface ThreeTextProps extends Omit<TextOptions, 'text'> {
  children: string;
  font: string | ArrayBuffer;
  material?: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  onLoad?: (geometry: THREE.BufferGeometry, info: TextGeometryInfo) => void;
  onError?: (error: Error) => void;
  vertexColors?: boolean;
}

export const Text = forwardRef<THREE.Mesh, ThreeTextProps>(
  function Text(props, ref) {
    const {
      children,
      font,
      material,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      onLoad,
      onError,
      vertexColors = true,
      ...restOptions
    } = props;

    const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(
      null
    );
    const [error, setError] = useState<Error | null>(null);
    const geometryRef = useRef<THREE.BufferGeometry | null>(null);

    const defaultMaterial = useMemo(() => {
      return new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        vertexColors
      });
    }, [vertexColors]);

    const finalMaterial = material || defaultMaterial;

    const memoizedTextOptions = useDeepCompareMemo(restOptions);

    useEffect(() => {
      let cancelled = false;

      async function setupText() {
        try {
          setError(null);

          if (cancelled) return;

          const text = await ThreeText.create({
            text: children,
            font,
            ...memoizedTextOptions
          });

          if (cancelled) {
            // If a newer render superseded this request, avoid leaking geometry
            text.geometry.dispose();
            return;
          }

          // Dispose previous geometry (if any) before swapping
          geometryRef.current?.dispose();
          geometryRef.current = text.geometry;
          setGeometry(text.geometry);
          if (onLoad) onLoad(text.geometry, text);
        } catch (err) {
          const error = err as Error;
          if (!cancelled) {
            setError(error);
            if (onError) onError(error);
            else console.error('ThreeText error:', error);
          }
        }
      }

      setupText();

      return () => {
        cancelled = true;
      };
    }, [font, children, memoizedTextOptions, onLoad, onError]);

    // Cleanup geometry on unmount
    useEffect(() => {
      return () => {
        geometryRef.current?.dispose();
        geometryRef.current = null;
      };
    }, []);

    // Cleanup default material when it changes or on unmount
    useEffect(() => {
      return () => {
        defaultMaterial.dispose();
      };
    }, [defaultMaterial]);

    if (error || !geometry) {
      return null;
    }

    return (
      <mesh
        ref={ref}
        geometry={geometry}
        material={finalMaterial}
        position={position}
        rotation={rotation}
        scale={scale}
      />
    );
  }
);
