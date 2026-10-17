precision mediump float;

varying vec2 v_uv;
uniform sampler2D u_texture;

void main() {
	gl_FragColor = texture2D(u_texture, v_uv);
}
