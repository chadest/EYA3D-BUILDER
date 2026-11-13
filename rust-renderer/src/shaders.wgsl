struct CameraUniform {
    view_proj: mat4x4<f32>,
    camera_pos: vec4<f32>,
    light_dir: vec4<f32>,
    light_color: vec4<f32>,
};

struct ObjectUniform {
    model: mat4x4<f32>,
    base_color: vec4<f32>,
    pbr_params: vec4<f32>, // x = roughness, y = metalness
};

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

@group(1) @binding(0)
var<uniform> obj: ObjectUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_pos: vec3<f32>,
    @location(1) world_normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let world_position = obj.model * vec4<f32>(in.position, 1.0);
    out.world_pos = world_position.xyz;
    out.world_normal = normalize((obj.model * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv = in.uv;
    out.clip_position = camera.view_proj * world_position;
    return out;
}

const PI: f32 = 3.14159265359;

fn distribution_ggx(n_dot_h: f32, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let denom = n_dot_h * n_dot_h * (a2 - 1.0) + 1.0;
    return a2 / (PI * denom * denom + 0.0001);
}

fn geometry_schlick_ggx(n_dot_v: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    return n_dot_v / (n_dot_v * (1.0 - k) + k + 0.0001);
}

fn geometry_smith(n_dot_v: f32, n_dot_l: f32, roughness: f32) -> f32 {
    return geometry_schlick_ggx(n_dot_v, roughness) * geometry_schlick_ggx(n_dot_l, roughness);
}

fn fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
    return f0 + (vec3<f32>(1.0) - f0) * pow(clamp(1.0 - cos_theta, 0.0, 1.0), 5.0);
}

fn aces_filmic(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let n = normalize(in.world_normal);
    let v = normalize(camera.camera_pos.xyz - in.world_pos);
    let l = normalize(camera.light_dir.xyz);
    let h = normalize(v + l);

    let albedo = obj.base_color.rgb;
    let roughness = clamp(obj.pbr_params.x, 0.04, 1.0);
    let metalness = clamp(obj.pbr_params.y, 0.0, 1.0);

    let f0 = mix(vec3<f32>(0.04), albedo, metalness);
    let n_dot_l = max(dot(n, l), 0.0);
    let n_dot_v = max(dot(n, v), 0.0);
    let n_dot_h = max(dot(n, h), 0.0);

    let ndf = distribution_ggx(n_dot_h, roughness);
    let g = geometry_smith(n_dot_v, n_dot_l, roughness);
    let f = fresnel_schlick(max(dot(h, v), 0.0), f0);

    let numerator = ndf * g * f;
    let denominator = 4.0 * n_dot_v * n_dot_l + 0.0001;
    let specular = numerator / denominator;

    let ks = f;
    let kd = (vec3<f32>(1.0) - ks) * (1.0 - metalness);

    let radiance = camera.light_color.rgb * camera.light_color.w;
    let direct = (kd * albedo / PI + specular) * radiance * n_dot_l;

    // Studio hemisphere fill (warm sky / cool ground)
    let hemi_factor = n.y * 0.5 + 0.5;
    let ambient_sky = vec3<f32>(0.24, 0.28, 0.34);
    let ambient_ground = vec3<f32>(0.08, 0.09, 0.11);
    let ambient = mix(ambient_ground, ambient_sky, hemi_factor) * albedo * (1.0 - metalness * 0.6);

    let hdr_color = ambient + direct;
    let mapped = aces_filmic(hdr_color * 1.1);
    return vec4<f32>(mapped, obj.base_color.a);
}
