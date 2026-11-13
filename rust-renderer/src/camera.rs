use bytemuck::{Pod, Zeroable};
use glam::{Mat4, Vec3};
use wgpu::util::DeviceExt;

/// GPU camera and directional sun-light uniform buffer (std140-aligned)
#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct CameraUniform {
    pub view_proj: [[f32; 4]; 4],
    pub camera_pos: [f32; 4],
    pub light_dir: [f32; 4],
    pub light_color: [f32; 4],
}

impl Default for CameraUniform {
    fn default() -> Self {
        let view = Mat4::look_at_rh(Vec3::new(4.0, 3.0, 5.0), Vec3::ZERO, Vec3::Y);
        let proj = Mat4::perspective_rh(50.0_f32.to_radians(), 16.0 / 9.0, 0.1, 1000.0);
        Self {
            view_proj: (proj * view).to_cols_array_2d(),
            camera_pos: [4.0, 3.0, 5.0, 1.0],
            light_dir: [0.4, 0.85, 0.35, 0.0],
            light_color: [1.0, 0.98, 0.95, 2.2],
        }
    }
}

pub struct CameraState {
    pub uniform: CameraUniform,
    pub buffer: wgpu::Buffer,
    pub bind_group: wgpu::BindGroup,
}

impl CameraState {
    pub fn new(device: &wgpu::Device, layout: &wgpu::BindGroupLayout) -> Self {
        let uniform = CameraUniform::default();
        let buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("eya3d_camera_uniform_buffer"),
            contents: bytemuck::cast_slice(&[uniform]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("eya3d_camera_bind_group"),
            layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: buffer.as_entire_binding(),
            }],
        });

        Self {
            uniform,
            buffer,
            bind_group,
        }
    }

    pub fn update_matrices(&mut self, queue: &wgpu::Queue, view_proj: &[f32], eye: &[f32]) {
        if view_proj.len() == 16 {
            self.uniform.view_proj = [
                [view_proj[0], view_proj[1], view_proj[2], view_proj[3]],
                [view_proj[4], view_proj[5], view_proj[6], view_proj[7]],
                [view_proj[8], view_proj[9], view_proj[10], view_proj[11]],
                [view_proj[12], view_proj[13], view_proj[14], view_proj[15]],
            ];
        }
        if eye.len() >= 3 {
            self.uniform.camera_pos = [eye[0], eye[1], eye[2], 1.0];
        }
        queue.write_buffer(&self.buffer, 0, bytemuck::cast_slice(&[self.uniform]));
    }

    pub fn update_light(&mut self, queue: &wgpu::Queue, dir: &[f32], color: &[f32], intensity: f32) {
        if dir.len() >= 3 {
            let v = Vec3::new(dir[0], dir[1], dir[2]).normalize_or_zero();
            self.uniform.light_dir = [v.x, v.y, v.z, 0.0];
        }
        if color.len() >= 3 {
            self.uniform.light_color = [color[0], color[1], color[2], intensity];
        }
        queue.write_buffer(&self.buffer, 0, bytemuck::cast_slice(&[self.uniform]));
    }
}
