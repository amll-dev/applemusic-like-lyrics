attribute vec2 a_pos;

varying vec2 v_uv;

void main() {
	gl_Position = vec4(a_pos, 0.0, 1.0);
	v_uv = a_pos * 0.5 + 0.5;
}
