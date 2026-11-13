use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

/// Interleaved GPU vertex attribute layout matching Three.js BufferGeometry extraction
#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct Vertex {
    pub position: [f32; 3],
    pub normal: [f32; 3],
    pub uv: [f32; 2],
}

impl Vertex {
    pub fn layout() -> wgpu::VertexBufferLayout<'static> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<Vertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x3,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x3,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 6]>() as wgpu::BufferAddress,
                    shader_location: 2,
                    format: wgpu::VertexFormat::Float32x2,
                },
            ],
        }
    }
}

/// Per-object model transform & PBR material parameters
#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct ObjectUniform {
    pub model: [[f32; 4]; 4],
    pub base_color: [f32; 4],
    /// x = roughness, y = metalness, z = emissive_strength, w = unused
    pub pbr_params: [f32; 4],
}

pub struct GpuMesh {
    pub vertex_buffer: wgpu::Buffer,
    pub index_buffer: wgpu::Buffer,
    pub index_count: u32,
    pub uniform_buffer: wgpu::Buffer,
    pub bind_group: wgpu::BindGroup,
}

impl GpuMesh {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        device: &wgpu::Device,
        object_layout: &wgpu::BindGroupLayout,
        vertices: &[Vertex],
        indices: &[u32],
        model: [[f32; 4]; 4],
        base_color: [f32; 4],
        roughness: f32,
        metalness: f32,
    ) -> Self {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("eya3d_mesh_vertex_buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("eya3d_mesh_index_buffer"),
            contents: bytemuck::cast_slice(indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        let uniform = ObjectUniform {
            model,
            base_color,
            pbr_params: [roughness.clamp(0.04, 1.0), metalness.clamp(0.0, 1.0), 0.0, 0.0],
        };

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("eya3d_mesh_uniform_buffer"),
            contents: bytemuck::cast_slice(&[uniform]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("eya3d_mesh_bind_group"),
            layout: object_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        Self {
            vertex_buffer,
            index_buffer,
            index_count: indices.len() as u32,
            uniform_buffer,
            bind_group,
        }
    }

    pub fn update_transform_and_material(
        &self,
        queue: &wgpu::Queue,
        model: [[f32; 4]; 4],
        base_color: [f32; 4],
        roughness: f32,
        metalness: f32,
    ) {
        let uniform = ObjectUniform {
            model,
            base_color,
            pbr_params: [roughness.clamp(0.04, 1.0), metalness.clamp(0.0, 1.0), 0.0, 0.0],
        };
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniform]));
    }
}
