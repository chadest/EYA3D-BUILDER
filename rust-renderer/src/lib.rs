mod camera;
mod mesh;

use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use camera::CameraState;
use mesh::{GpuMesh, Vertex};

#[wasm_bindgen]
pub struct EyaRustRenderer {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    render_pipeline: wgpu::RenderPipeline,
    depth_view: wgpu::TextureView,
    camera_state: CameraState,
    object_layout: wgpu::BindGroupLayout,
    meshes: HashMap<String, GpuMesh>,
    clear_color: wgpu::Color,
}

#[wasm_bindgen]
impl EyaRustRenderer {
    /// Initialize WebGPU/WebGL2 surface and PBR render pipeline on an HTMLCanvasElement
    #[wasm_bindgen]
    pub async fn create(canvas_id: &str) -> Result<EyaRustRenderer, JsValue> {
        console_error_panic_hook::set_once();

        let window = web_sys::window().ok_or_else(|| JsValue::from_str("Missing window"))?;
        let document = window.document().ok_or_else(|| JsValue::from_str("Missing document"))?;
        let canvas = document
            .get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str(&format!("Canvas '{}' not found", canvas_id)))?
            .dyn_into::<web_sys::HtmlCanvasElement>()?;

        let width = canvas.width().max(1);
        let height = canvas.height().max(1);

        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU | wgpu::Backends::GL,
            ..Default::default()
        });

        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
            .map_err(|e| JsValue::from_str(&format!("Surface creation error: {e:?}")))?;

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| JsValue::from_str("No compatible WebGPU/WebGL adapter found"))?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("eya3d_wgpu_device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults()
                        .using_resolution(adapter.limits()),
                    memory_hints: Default::default(),
                },
                None,
            )
            .await
            .map_err(|e| JsValue::from_str(&format!("Device request error: {e:?}")))?;

        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(caps.formats[0]);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width,
            height,
            present_mode: wgpu::PresentMode::Fifo,
            alpha_mode: caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        let camera_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("eya3d_camera_layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            }],
        });

        let object_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("eya3d_object_layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            }],
        });

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("eya3d_pbr_shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders.wgsl").into()),
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("eya3d_pipeline_layout"),
            bind_group_layouts: &[&camera_layout, &object_layout],
            push_constant_ranges: &[],
        });

        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("eya3d_pbr_pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex::layout()],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                cull_mode: Some(wgpu::Face::Back),
                front_face: wgpu::FrontFace::Ccw,
                ..Default::default()
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth24Plus,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::Less,
                stencil: wgpu::StencilState::default(),
                bias: wgpu::DepthBiasState::default(),
            }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let depth_view = Self::create_depth_view(&device, width, height);
        let camera_state = CameraState::new(&device, &camera_layout);

        Ok(Self {
            surface,
            device,
            queue,
            config,
            render_pipeline,
            depth_view,
            camera_state,
            object_layout,
            meshes: HashMap::new(),
            clear_color: wgpu::Color {
                r: 0.035,
                g: 0.039,
                b: 0.047,
                a: 1.0,
            },
        })
    }

    fn create_depth_view(device: &wgpu::Device, width: u32, height: u32) -> wgpu::TextureView {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("eya3d_depth_texture"),
            size: wgpu::Extent3d {
                width: width.max(1),
                height: height.max(1),
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth24Plus,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        texture.create_view(&wgpu::TextureViewDescriptor::default())
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }
        self.config.width = width;
        self.config.height = height;
        self.surface.configure(&self.device, &self.config);
        self.depth_view = Self::create_depth_view(&self.device, width, height);
    }

    pub fn set_clear_color(&mut self, r: f64, g: f64, b: f64) {
        self.clear_color = wgpu::Color { r, g, b, a: 1.0 };
    }

    pub fn set_camera(&mut self, view_proj: &[f32], eye: &[f32]) {
        self.camera_state.update_matrices(&self.queue, view_proj, eye);
    }

    pub fn set_light(&mut self, dir: &[f32], color: &[f32], intensity: f32) {
        self.camera_state.update_light(&self.queue, dir, color, intensity);
    }

    /// Upload or replace a mesh's interleaved vertex/index buffers and PBR material state
    #[allow(clippy::too_many_arguments)]
    pub fn upsert_mesh(
        &mut self,
        id: &str,
        positions: &[f32],
        normals: &[f32],
        uvs: &[f32],
        indices: &[u32],
        model_matrix: &[f32],
        color_rgba: &[f32],
        roughness: f32,
        metalness: f32,
    ) {
        let vert_count = positions.len() / 3;
        let mut vertices = Vec::with_capacity(vert_count);
        for i in 0..vert_count {
            let p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
            let n = if normals.len() >= (i + 1) * 3 {
                [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]]
            } else {
                [0.0, 1.0, 0.0]
            };
            let uv = if uvs.len() >= (i + 1) * 2 {
                [uvs[i * 2], uvs[i * 2 + 1]]
            } else {
                [0.0, 0.0]
            };
            vertices.push(Vertex {
                position: p,
                normal: n,
                uv,
            });
        }

        let model = if model_matrix.len() == 16 {
            [
                [model_matrix[0], model_matrix[1], model_matrix[2], model_matrix[3]],
                [model_matrix[4], model_matrix[5], model_matrix[6], model_matrix[7]],
                [model_matrix[8], model_matrix[9], model_matrix[10], model_matrix[11]],
                [model_matrix[12], model_matrix[13], model_matrix[14], model_matrix[15]],
            ]
        } else {
            glam::Mat4::IDENTITY.to_cols_array_2d()
        };

        let base_color = if color_rgba.len() >= 4 {
            [color_rgba[0], color_rgba[1], color_rgba[2], color_rgba[3]]
        } else {
            [0.29, 0.56, 0.89, 1.0]
        };

        let gpu_mesh = GpuMesh::new(
            &self.device,
            &self.object_layout,
            &vertices,
            indices,
            model,
            base_color,
            roughness,
            metalness,
        );
        self.meshes.insert(id.to_string(), gpu_mesh);
    }

    pub fn update_mesh_transform(
        &self,
        id: &str,
        model_matrix: &[f32],
        color_rgba: &[f32],
        roughness: f32,
        metalness: f32,
    ) {
        if let Some(mesh) = self.meshes.get(id) {
            let model = if model_matrix.len() == 16 {
                [
                    [model_matrix[0], model_matrix[1], model_matrix[2], model_matrix[3]],
                    [model_matrix[4], model_matrix[5], model_matrix[6], model_matrix[7]],
                    [model_matrix[8], model_matrix[9], model_matrix[10], model_matrix[11]],
                    [model_matrix[12], model_matrix[13], model_matrix[14], model_matrix[15]],
                ]
            } else {
                glam::Mat4::IDENTITY.to_cols_array_2d()
            };
            let base_color = if color_rgba.len() >= 4 {
                [color_rgba[0], color_rgba[1], color_rgba[2], color_rgba[3]]
            } else {
                [0.29, 0.56, 0.89, 1.0]
            };
            mesh.update_transform_and_material(&self.queue, model, base_color, roughness, metalness);
        }
    }

    pub fn remove_mesh(&mut self, id: &str) {
        self.meshes.remove(id);
    }

    pub fn render(&mut self) -> Result<(), JsValue> {
        let frame = match self.surface.get_current_texture() {
            Ok(f) => f,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                self.surface.configure(&self.device, &self.config);
                return Ok(());
            }
            Err(e) => return Err(JsValue::from_str(&format!("Surface error: {e:?}"))),
        };

        let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("eya3d_render_encoder"),
        });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("eya3d_main_render_pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(self.clear_color),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.depth_view,
                    depth_ops: Some(wgpu::DepthOps {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            pass.set_pipeline(&self.render_pipeline);
            pass.set_bind_group(0, &self.camera_state.bind_group, &[]);

            for mesh in self.meshes.values() {
                if mesh.index_count == 0 {
                    continue;
                }
                pass.set_bind_group(1, &mesh.bind_group, &[]);
                pass.set_vertex_buffer(0, mesh.vertex_buffer.slice(..));
                pass.set_index_buffer(mesh.index_buffer.slice(..), wgpu::IndexFormat::Uint32);
                pass.draw_indexed(0..mesh.index_count, 0, 0..1);
            }
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        frame.present();
        Ok(())
    }
}
