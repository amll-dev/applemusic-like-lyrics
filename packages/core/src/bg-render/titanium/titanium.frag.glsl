precision highp float;

uniform vec2 u_resolution;

uniform float u_colorTime;
uniform float u_flowTime;
uniform float u_flowSpeed;
uniform vec3 u_colors[4];
uniform vec3 u_seed;
uniform vec3 u_crestMotion;
uniform vec2 u_grainOffset;
uniform float u_aspect;
uniform vec4 u_metal;
uniform float u_lyricScrim;
uniform float u_lowFreq;
uniform bool u_enableDithering;

const vec3 LUMA_WEIGHT = vec3(0.2126, 0.7152, 0.0722);
const vec3 TITANIUM_TINT = vec3(1.02, 1.0, 0.97);
const vec3 HIGHLIGHT_COLOR = vec3(1.0, 0.99, 0.96);

float encodeSrgb(float channel) {
	return channel <= 0.0031308
		? 12.92 * channel
		: 1.055 * pow(max(channel, 0.0), 1.0 / 2.4) - 0.055;
}

vec3 okLabToSrgb(vec3 color) {
	float lRoot = color.x + 0.3963377774 * color.y + 0.2158037573 * color.z;
	float mRoot = color.x - 0.1055613458 * color.y - 0.0638541728 * color.z;
	float sRoot = color.x - 0.0894841775 * color.y - 1.2914855480 * color.z;
	float l = lRoot * lRoot * lRoot;
	float m = mRoot * mRoot * mRoot;
	float s = sRoot * sRoot * sRoot;
	vec3 linearColor = vec3(
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
	);
	return vec3(
		encodeSrgb(linearColor.r),
		encodeSrgb(linearColor.g),
		encodeSrgb(linearColor.b)
	);
}

float interleavedGradientNoise(vec2 position) {
	return fract(
		52.9829189 * fract(dot(position, vec2(0.06711056, 0.00583715)))
	);
}

vec4 hashGrid(vec2 cell) {
	vec4 p = fract(vec4(cell.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
	p += dot(p, p.wzxy + 33.33);
	return fract((p.xxyz + p.yzzw) * p.zywx);
}

const float MICRO_CELLS = 256.0;
const float HASH_PERIOD = 256.0;
const float GLINT_CELLS = 140.0;
const float SPARKLE_THRESHOLD = 0.95;
const float BRIGHT_FACE_PARTICLE_GAIN = 0.6;
const float BRIGHT_FACE_RAMP_START = 0.3;
const float BRIGHT_FACE_RAMP_END = 0.6;

vec4 sampleSandLayer(
	vec2 point,
	float scale,
	vec2 shift,
	vec2 flowOffset,
	vec3 surfaceNormal,
	vec3 halfDir,
	float gate
) {
	vec2 warped =
		point +
		0.08 *
			vec2(
				sin(point.y * 2.7 + u_seed.x * 3.0),
				cos(point.x * 2.3 + u_seed.y * 2.0)
			);
	vec2 base = warped * (scale * MICRO_CELLS);
	base +=
		vec2(sin(base.y * 0.11 + u_seed.x), cos(base.x * 0.09 + u_seed.y)) * 0.6;
	vec2 grid =
		base +
		shift +
		mod(flowOffset * (scale * MICRO_CELLS), vec2(HASH_PERIOD));
	vec2 cell = floor(grid);
	vec2 local = fract(grid);
	vec4 rnd = hashGrid(mod(cell, HASH_PERIOD));
	float brightness = rnd.z;
	float presentRand = rnd.w;
	float sparkleRand = fract(rnd.z * 43.1 + rnd.w * 91.7);

	float threshold = mix(0.73, 0.37, gate);
	float present = smoothstep(threshold, threshold + 0.14, presentRand);
	vec2 offset = (rnd.xy - 0.5) * 0.6;
	float radius = (0.3 + 0.3 * brightness) * mix(0.55, 1.0, gate);
	float distanceToCenter =
		length(local - 0.5 - offset) / max(radius, 1e-3);
	float mask = smoothstep(1.0, 0.5, distanceToCenter) * present;
	float pixelsPerCell = u_resolution.y / (scale * MICRO_CELLS);
	mask *= clamp(radius * pixelsPerCell, 0.2, 1.0);
	vec4 posRand = hashGrid(floor(point * GLINT_CELLS + shift * 97.0));
	vec3 grainNormal = normalize(
		surfaceNormal +
		vec3((rnd.xy - 0.5) * 0.8 + (posRand.xy - 0.5) * 1.4, 0.0)
	);
	float sparkle = step(SPARKLE_THRESHOLD, sparkleRand);
	float alignment = dot(grainNormal, halfDir);
	float light = smoothstep(
		mix(0.74, 0.42, sparkle),
		mix(0.94, 0.8, sparkle),
		alignment
	);
	float glintGain = mix(0.9, 3.2, sparkle);

	return vec4(mask, light * mask * glintGain, brightness * mask, 0.0);
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_resolution;
	vec2 point = vec2((uv.x - 0.5) * u_aspect, uv.y - 0.5);
	float colorPhase = u_colorTime * 6.28318530718;

	vec2 warp =
		vec2(
			sin(point.y * 1.7 + colorPhase + u_seed.x),
			cos(point.x * 1.4 - colorPhase * 2.0 + u_seed.y)
		) * 0.08;
	vec2 blended = point + warp;
	float blendX = smoothstep(-0.6, 0.6, blended.x);
	float blendY = smoothstep(-0.6, 0.6, blended.y);
	vec3 okLab = mix(
		mix(u_colors[2], u_colors[3], blendX),
		mix(u_colors[0], u_colors[1], blendX),
		blendY
	);
	vec3 base = okLabToSrgb(okLab);

	float luma = dot(base, LUMA_WEIGHT);
	base += TITANIUM_TINT * 0.02 * u_metal.z;
	vec3 color = mix(base, vec3(luma) * TITANIUM_TINT, u_metal.w);

	vec3 lightDir = normalize(
		vec3(0.18 + 0.3 * sin(colorPhase), 0.8, 0.55)
	);
	vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));

	float f1 =
		point.y -
		(
			0.45 * sin(point.x * 1.6 + u_seed.x + u_crestMotion.x) +
			0.10 * sin(point.x * 3.4 + u_seed.y + u_crestMotion.y)
		) -
		u_crestMotion.z;
	float slope1 =
		-0.45 * 1.6 * cos(point.x * 1.6 + u_seed.x + u_crestMotion.x) -
		0.10 * 3.4 * cos(point.x * 3.4 + u_seed.y + u_crestMotion.y);

	float crest = f1;
	float crestProximity = exp(-crest * crest * 6.0);

	const float RIDGE_WIDTH = 0.018;
	float ridgeHeight =
		0.55 + 0.15 * sin(point.x * 1.1 + u_seed.z * 4.0);
	float ridgeSlope =
		-ridgeHeight * crest /
		sqrt(crest * crest + RIDGE_WIDTH * RIDGE_WIDTH);
	float duneX = point.x * 1.8 + u_seed.x * 3.0;
	float duneY = point.y * 2.4 + point.x * 0.6 + u_seed.y * 5.0;
	float dhdx =
		ridgeSlope * (-slope1) +
		0.10 * 1.8 * cos(duneX) +
		0.10 * 0.6 * cos(duneY);
	float dhdy = ridgeSlope + 0.10 * 2.4 * cos(duneY);
	vec3 surfaceNormal = normalize(vec3(-dhdx, -dhdy, 1.0));

	float diffuse = max(dot(surfaceNormal, lightDir), 0.0);
	color *= 0.16 + 0.95 * diffuse;
	color *= mix(1.0, mix(0.48, 1.0, crestProximity), diffuse);
	color += TITANIUM_TINT * (diffuse * 0.05 + (1.0 - diffuse) * 0.015) * u_metal.z;
	float lightLevel = clamp(
		diffuse * mix(0.35, 1.0, crestProximity),
		0.0,
		1.0
	);
	float grainGate = 0.1 + 0.9 * lightLevel * lightLevel;
	grainGate *= mix(0.7, 1.0, smoothstep(0.06, 0.45, luma));

	float centerSlope =
		-0.45 * 1.6 * cos(u_seed.x) - 0.10 * 3.4 * cos(u_seed.y);
	vec2 tangent = normalize(vec2(1.0, -centerSlope));
	float directionSign = step(0.0, f1) * 2.0 - 1.0;
	const float FINE_SPEED = 1.35;
	vec2 flowOffset =
		tangent * directionSign * (u_flowTime * u_flowSpeed);
	vec2 grainPoint = point + u_grainOffset;

	vec4 coarse = sampleSandLayer(
		grainPoint,
		0.9,
		vec2(0.0),
		flowOffset,
		surfaceNormal,
		halfDir,
		grainGate
	);
	vec4 fine = sampleSandLayer(
		grainPoint,
		2.9,
		vec2(0.37, 0.61),
		flowOffset * FINE_SPEED,
		surfaceNormal,
		halfDir,
		grainGate
	);
	float sandMask = max(coarse.x, fine.x);
	float glint = max(coarse.y, fine.y);
	float grainBrightness =
		(coarse.z + fine.z) / max(coarse.x + fine.x, 1e-3);

	float grainGain =
		mix(0.34, 1.0, smoothstep(0.0, 0.6, diffuse)) *
		mix(0.32, 1.0, crestProximity);
	grainGain *= mix(1.0, 0.7, u_lyricScrim);

	float brightFaceGain = mix(
		1.0,
		BRIGHT_FACE_PARTICLE_GAIN,
		smoothstep(
			BRIGHT_FACE_RAMP_START,
			BRIGHT_FACE_RAMP_END,
			diffuse
		)
	);

	color +=
		HIGHLIGHT_COLOR *
		sandMask *
		(0.015 + 0.04 * grainBrightness) *
		u_metal.x *
		grainGain *
		brightFaceGain;
	color +=
		HIGHLIGHT_COLOR *
		glint *
		(0.65 + 0.35 * grainBrightness) *
		(0.35 + 0.65 * diffuse) *
		u_metal.y *
		grainGain *
		brightFaceGain;

	color *= 1.0 + (grainBrightness - 0.5) * 0.04 * u_metal.x;

	color *= mix(1.0, 0.86, u_lyricScrim);

	color *= 1.0 - 0.08 * u_lowFreq;

	color = color / (1.0 + max(color, 0.0) * (0.28 + 0.35 * u_lyricScrim));

	if (u_enableDithering) {
		float dither = interleavedGradientNoise(gl_FragCoord.xy) - 0.5;
		color += vec3(dither / 255.0);
	}

	gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
