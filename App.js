//	https://jscompress.com/
const Pop = {};
Pop.Debug = console.log;
Pop.Warning = console.warn;

//	create a promise function with the Resolve & Reject functions attached so we can call them
Pop.CreatePromise = function()
{
	let Callbacks = {};
	let PromiseHandler = function(Resolve,Reject)
	{
		Callbacks.Resolve = Resolve;
		Callbacks.Reject = Reject;
	}
	let Prom = new Promise(PromiseHandler);
	Prom.Resolve = Callbacks.Resolve;
	Prom.Reject = Callbacks.Reject;
	return Prom;
}

Pop.Yield = function(Milliseconds)
{
	const Promise = Pop.CreatePromise();
	setTimeout( Promise.Resolve, Milliseconds );
	return Promise;
}


class GeoQuad_t
{
	constructor(gl)
	{
		this.PrimitiveType = gl.TRIANGLE_FAN;
		this.Attrib = {};
		this.Attrib.Name = 'VertUv';
		this.Attrib.Data = new Float32Array([0,0,	1,0,	1,1,	0,1	]);
		this.Attrib.Size = 2;
		this.Attrib.Type = gl.FLOAT;
		this.Attrib.StrideBytes = 0;
		this.Attrib.Normalised = false;
		this.Attrib.OffsetBytes = 0;
		this.IndexCount = this.Attrib.Data.length / this.Attrib.Size;
		this.Vao = gl.createVertexArray();
		this.Buffer = gl.createBuffer();
		gl.bindVertexArray( this.Vao );
		gl.bindBuffer( gl.ARRAY_BUFFER, this.Buffer );
		gl.bufferData( gl.ARRAY_BUFFER, this.Attrib.Data, gl.STATIC_DRAW );
		this.BoundVertexPointerToShader = null;
	}
	
	Bind(gl,ShaderProgram)
	{
		//if ( this.BoundVertexPointerToShader !== ShaderProgram )
		{
			//	can't setup attribs on voa until we have a shader
			const Location = gl.getAttribLocation(ShaderProgram,this.Attrib.Name);
			gl.vertexAttribPointer( Location, this.Attrib.Size, this.Attrib.Type, this.Attrib.Normalised, this.Attrib.StrideBytes, this.Attrib.OffsetBytes );
			gl.enableVertexAttribArray( Location );
			this.BoundVertexPointerToShader = ShaderProgram;
		}
		gl.bindVertexArray( this.Vao );
	}
}

class Shader_t
{
	constructor(RenderContext,VertSource,FragSource)
	{
		const gl = RenderContext;
		this.UniformCache = {};
		const FragShader = this.CompileShader( RenderContext, gl.FRAGMENT_SHADER, FragSource, 'Frag' );
		const VertShader = this.CompileShader( RenderContext, gl.VERTEX_SHADER, VertSource, 'Vert' );
		this.Program = gl.createProgram();
		gl.attachShader( this.Program, VertShader );
		gl.attachShader( this.Program, FragShader );
		gl.linkProgram( this.Program );
		let LinkStatus = gl.getProgramParameter( this.Program, gl.LINK_STATUS );
		if ( !LinkStatus )
		{
			//	gr: list cases when no error "" occurs here;
			//	- too many varyings > MAX_VARYING_VECTORS
			const Error = gl.getProgramInfoLog(this.Program);
			throw `Failed to link shaders; ${Error}`;
		}
	}
	
	CompileShader(gl,Type,Source,TypeName)
	{
		const Shader = gl.createShader(Type);
		gl.shaderSource( Shader, Source );
		gl.compileShader( Shader );
		const CompileStatus = gl.getShaderParameter( Shader, gl.COMPILE_STATUS);
		if ( !CompileStatus )
		{
			const Error = gl.getShaderInfoLog(Shader);
			throw `Failed to compile ${TypeName}: ${Error}`;
		}
		return Shader;
	}
}

const QuadVertShader = `
precision highp float;
attribute vec2 VertUv;
varying vec2 LocalUv;
void main()
{
	LocalUv = VertUv;
	vec2 e = vec2(-1,1);
	gl_Position = vec4( mix(e.xy,e.yx,LocalUv), 0, 1 );
}
`;


const FragDebugUvShader = `
precision highp float;
varying vec2 LocalUv;
void main()
{
	gl_FragColor = vec4(LocalUv,0,1);
}
`;

import FragRaySphereShader from './RayMarch.frag.glsl.js';

const AssetCaches = {};
const AssetFetchs = {};

AssetFetchs['Quad'] = GetQuad;
AssetFetchs['Debug'] = GetDebugShader;
AssetFetchs['RaySphere'] = GetRaySphereShader;

function GetAsset(Name,Context)
{
	if ( !AssetCaches[Name] )
		AssetCaches[Name] = AssetFetchs[Name](Context);
	return AssetCaches[Name];
}

function GetQuad(RenderContext)
{
	return new GeoQuad_t(RenderContext);
}

function GetDebugShader(RenderContext)
{
	return new Shader_t(RenderContext,QuadVertShader,FragDebugUvShader);
}

function GetRaySphereShader(RenderContext)
{
	return new Shader_t(RenderContext,QuadVertShader,FragRaySphereShader);
}

class RenderTarget_t
{
	constructor(RenderContext)
	{
		this.gl = RenderContext;
	}
	
	Clear(r,g,b,a=1)
	{
		const gl = this.gl;
		gl.clearColor( r, g, b, a );
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.disable(gl.CULL_FACE);
		gl.disable(gl.BLEND);
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.SCISSOR_TEST);
		//	to make blending work well, don't reject things on same plane
		gl.depthFunc(gl.LEQUAL);

		//gl.disable(gl.DEPTH_TEST);
	}
	
	Draw(Geo,Shader,Uniforms)
	{
		const gl = this.gl;
		Geo = GetAsset(Geo,gl);
		Shader = GetAsset(Shader,gl);
		gl.useProgram( Shader.Program );
		Geo.Bind( gl, Shader.Program );
		gl.drawArrays( Geo.PrimitiveType, 0, Geo.IndexCount );
		
		/*
		this.SetGeo(Geo,gl);
		this.SetShader(Shader,gl);
		Object.entries(Uniforms).forEach(kv => this.SetUniform(...kv,gl).bind(this) );
		this.DrawTriangles(TriangleCount,gl);
		 */
	}
/*
	SetShader(Name,gl)
	{
		const Program = RenderContext.GetShaderProgram(Name);
		gl.useProgram( Program );
	}

	SetGeo(Name,gl)
	{
		const TriangleBuffer = RenderContext.GetGeoTriangleBuffer(Name);
		TriangleBuffer.Bind( RenderContext );
	}
	
	SetUniform(Name,Value,gl)
	{
	}
	
	DrawTriangles(TriangleCount,gl)
	{
	}
	*/
}



const Params = {}
Params.ClearColour = [0.4,0.5,0];
Params.Time = 0;

//	we don't use the browser anim loop as it stops in webxr mode
//	so we get update from render
function Update(TimeStepMs=1000/60)
{
	Params.Time += TimeStepMs;
	Params.ClearColour[2] = (Params.Time/1000) % 1;
}

function Render(RenderTarget,Camera)
{
	Update();
	//	bind rt
	//	bind shader
	//	bind uniforms
	//	bind geo
	//	render geo
	RenderTarget.Clear(...Params.ClearColour);

	const Uniforms = Object.assign({},Camera);
	
	Uniforms.ScreenToCameraTransform = Camera.ProjectionMatrix;
	Uniforms.CameraToWorldTransform = Camera.LocalToWorld;
	
	RenderTarget.Draw('Quad','Debug',Uniforms);
	RenderTarget.Draw('Quad','RaySphere',Uniforms);
}

async function CreateRenderContext(Canvas)
{
	const ContextMode = "webgl2";
	const Options = {};
	Options.xrCompatible = true;
	const Context = Canvas.getContext( ContextMode, Options );
	return Context;
}

class Pop_Xr_Device
{
	constructor(Session,ReferenceSpace,RenderContext)
	{
		//	overwrite this
		this.OnRender = function(){	Pop.Debug(`XR render`);	}
		
		this.Session = Session;
		this.ReferenceSpace = ReferenceSpace;
		this.RenderContext = RenderContext;

		this.WaitForExitPromise = Pop.CreatePromise();
		//	store input state so we can detect button up, tracking lost/regained
		this.InputStates = {};	//	[Name] = XrInputState
		
		//	catch exit
		Session.addEventListener('end', this.WaitForExitPromise.Resolve );
		
		this.InitLayer();
		
		//	start loop
		Session.requestAnimationFrame( this.OnFrame.bind(this) );
	}
	
	WaitForExit()
	{
		return this.WaitForExitPromise;
	}
	
	//	I think here we can re-create layers if context dies,
	//	without recreating device
	InitLayer()
	{
		const gl = this.RenderContext;
		this.Layer = new XRWebGLLayer(this.Session, gl);
		this.Session.updateRenderState({ baseLayer: this.Layer });
	}
	
	OnFrame(TimeMs,Frame)
	{
		//Pop.Debug("XR frame",Frame);
		//	request next frame
		this.Session.requestAnimationFrame( this.OnFrame.bind(this) );
		
		//	get pose in right space
		const Pose = Frame.getViewerPose(this.ReferenceSpace);
		
		//	don't know what to render?
		if ( !Pose )
		{
			Pop.Warning(`XR no pose`,Pose);
			return;
		}
		
		
		const glLayer = this.Session.renderState.baseLayer;
		const gl = this.RenderContext;
		
		const RenderView = function(View)
		{
			const RenderTarget = new RenderTarget_t(gl);
			const FrameBuffer = glLayer.framebuffer;
			const Viewport = glLayer.getViewport(View);
			function BindRenderTarget()
			{
				const RenderTargetRect = [Viewport.x,Viewport.y,Viewport.width,Viewport.height];
				gl.bindFramebuffer( gl.FRAMEBUFFER, FrameBuffer );
				gl.viewport( ...RenderTargetRect );
				gl.scissor( ...RenderTargetRect );
				//this.ResetState();
			}

			//	camera is reduced to a bunch of uniforms
			let Camera = {};
			
			//	use the render params on our camera
			if ( Frame.session.renderState )
			{
				Camera.NearDistance = Frame.session.renderState.depthNear || 0.01;
				Camera.FarDistance = Frame.session.renderState.depthFar || 100;
				Camera.FovVertical = Frame.session.renderState.inlineVerticalFieldOfView || 45;
			}
			
			//	update camera
			//	view has an XRRigidTransform (quest)
			//	https://developer.mozilla.org/en-US/docs/Web/API/XRRigidTransform
			Camera.Transform = View.transform;	//	stored for debugging
			
			//	write position (w should always be 0
			Camera.Position = [View.transform.position.x,View.transform.position.y,View.transform.position.z];
			Camera.LocalToWorld = View.transform.inverse.matrix;
			Camera.WorldToLocal = View.transform.matrix;
			//	LocalToView
			Camera.ProjectionMatrix = View.projectionMatrix;
			
			BindRenderTarget();
			this.OnRender( RenderTarget, Camera );
		}
		Pose.views.forEach( RenderView.bind(this) );
	}
}

async function CreateWebxrDevice(RenderContext,OnWaitForCallback)
{
	const PlatformXr = navigator.xr;
	//	need to create session in a user callback
	const SessionPromise = Pop.CreatePromise();
	const Callback = function()
	{
		//	gr: could use a generic callback like the audio system does
		//	this should be called from user interaction, so we start,
		//	and return that promise
		try
		{
			const SessionMode = 'immersive-vr';
			const Options = {};
			Options.optionalFeatures = ['local-floor','hand-tracking','bounded-floor'];
			const RequestSessionPromise = PlatformXr.requestSession(SessionMode,Options);
			RequestSessionPromise.then(SessionPromise.Resolve).catch(SessionPromise.Reject);
		}
		catch(e)
		{
			SessionPromise.Reject(e);
		}
	}
	OnWaitForCallback(Callback);
	const Session = await SessionPromise;
	async function GetReferenceSpace()
	{
		const ReferenceSpaceType = 'local-floor';
		const ReferenceSpace = await Session.requestReferenceSpace('local-floor');
		ReferenceSpace.Type = ReferenceSpaceType;
		return ReferenceSpace;
	}
	const ReferenceSpace = await GetReferenceSpace();
	Pop.Debug(`Got XR ReferenceSpace`,ReferenceSpace);
	
	const Device = new Pop_Xr_Device( Session, ReferenceSpace, RenderContext );
	return Device;
}


function GetMatrixIdentity()
{
	return [1,0,0,0,	0,1,0,0,	0,0,1,0,	0,0,0,1	];
}

class ScreenDevice_t
{
	constructor(RenderContext)
	{
		this.Camera = {};
		this.OnRender = function(){};

		let RenderCallback = function(Timestamp)
		{
			window.requestAnimationFrame(RenderCallback.bind(this));
			this.OnRenderCallback(RenderContext);
		}
		RenderCallback.call(this);
	}
	
	OnRenderCallback(RenderContext)
	{
		this.Camera.Position = [0,0,0];
		this.Camera.LocalToWorld = GetMatrixIdentity();
		this.Camera.WorldToLocal = GetMatrixIdentity();
		this.Camera.ProjectionMatrix = GetMatrixIdentity();

		let RenderTarget = new RenderTarget_t(RenderContext);
		this.OnRender( RenderTarget, this.Camera );
	}
}


export default async function Main(Canvas,StartButton)
{
	//	called when xr needs to wait for user input
	function OnWaitForCallback(OnClicked)
	{
		function OnButtonClicked()
		{
			StartButton.style.visibility = 'hidden';
			OnClicked();
		}
		StartButton.onclick = OnButtonClicked;
		StartButton.style.visibility = 'visible';
	}
	
	const RenderContext = await CreateRenderContext(Canvas);
	
	//const ScreenDevice = new ScreenDevice_t(RenderContext);
	//ScreenDevice.OnRender = Render;
	
	while(true)
	{
		try
		{
			const Device = await CreateWebxrDevice(RenderContext,OnWaitForCallback);
			Device.OnRender = Render;
			//	wait for device to die
			await Device.WaitForExit();
		}
		catch(e)
		{
			Pop.Warning(e);
			await Pop.Yield(1000);
		}
	}
}
