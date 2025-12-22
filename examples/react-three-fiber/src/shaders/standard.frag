uniform float opacity;
varying vec3 vColor;
varying vec3 vNormal;

void main() {
  vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0));
  vec3 normal = normalize(vNormal);
  
  // Use abs for double-sided lighting
  float diffuse = abs(dot(normal, lightDirection));
  float ambient = 0.3;
  float lightIntensity = ambient + diffuse * 0.7;
  vec3 baseColor = length(vColor) > 0.0 ? vColor : vec3(1.0);
  
  vec3 finalColor = baseColor * lightIntensity;
  
  gl_FragColor = vec4(finalColor, opacity);
}

