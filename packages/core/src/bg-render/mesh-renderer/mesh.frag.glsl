precision mediump float;

varying vec3 v_color;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_volume;
uniform float u_alpha;
uniform float u_sinAngle;
uniform float u_cosAngle;

// 预计算常量
const float INV_255 = 1.0 / 255.0;
const float HALF_INV_255 = 0.5 / 255.0;
const float GRADIENT_NOISE_A = 52.9829189;
const vec2 GRADIENT_NOISE_B = vec2(0.06711056, 0.00583715);

float gradientNoise(in vec2 uv) {
    return fract(GRADIENT_NOISE_A * fract(dot(uv, GRADIENT_NOISE_B)));
}

void main() {
    float volumeEffect = u_volume * 2.0;

    float dither = INV_255 * gradientNoise(gl_FragCoord.xy) - HALF_INV_255;

    vec2 centeredUV = v_uv - vec2(0.2);

    vec2 rotatedUV = vec2(
        u_cosAngle * centeredUV.x - u_sinAngle * centeredUV.y,
        u_sinAngle * centeredUV.x + u_cosAngle * centeredUV.y
    );

    vec2 finalUV = rotatedUV * max(0.001, 1.0 - volumeEffect) + vec2(0.5);
    
    vec4 result = texture2D(u_texture, finalUV);
    
    float alphaVolumeFactor = u_alpha * max(0.5, 1.0 - u_volume * 0.5);
    result.rgb *= v_color * alphaVolumeFactor;
    result.a *= alphaVolumeFactor;
    
    result.rgb += vec3(dither);
    
    float dist = distance(v_uv, vec2(0.5));
    float vignette = smoothstep(0.8, 0.3, dist);
    float mask = 0.6 + vignette * 0.4;
    result.rgb *= mask;
    
    gl_FragColor = result;
}
