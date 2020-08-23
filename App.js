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


function InvertMatrix4x4(Matrix)
{
	//	3x3 inversion from
	//	https://codegolf.stackexchange.com/questions/168828/find-the-inverse-of-a-3-by-3-matrix
	//(a,b,c,d,e,f,g,h,i)=>[x=e*i-h*f,c*h-b*i,b*f-c*e,y=f*g-d*i,a*i-c*g,d*c-a*f,z=d*h-g*e,g*b-a*h,a*e-d*b].map(v=>v/=a*x+b*y+c*z)
	
	//	gr: my attempt at reducing in a similar way
	let [a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p] = Matrix;
	let r =
	[
		f*k*p - f*o*l - g*j*p + g*n*l + h*j*o - h*n*k,
		-b*k*p + b*o*l + c*j*p - c*n*l - d*j*o + d*n*k,
		b*g*p - b*o*h - c*f*p + c*n*h + d*f*o - d*n*g,
		-b*g*l + b*k*h + c*f*l - c*j*h - d*f*k + d*j*g,
	
		-e*k*p + e*o*l + g*i*p - g*m*l - h*i*o + h*m*k,
		a*k*p - a*o*l - c*i*p + c*m*l + d*i*o - d*m*k,
		-a*g*p + a*o*h + c*e*p - c*m*h - d*e*o + d*m*g,
		a*g*l - a*k*h - c*e*l + c*i*h + d*e*k - d*i*g,
	
		e*j*p - e*n*l - f*i*p + f*m*l + h*i*n - h*m*j,
		-a*j*p + a*n*l + b*i*p - b*m*l - d*i*n + d*m*j,
		a*f*p - a*n*h - b*e*p + b*m*h + d*e*n - d*m*f,
		-a*f*l + a*j*h + b*e*l - b*i*h - d*e*j + d*i*f,
	
		-e*j*o + e*n*k + f*i*o - f*m*k - g*i*n + g*m*j,
		a*j*o - a*n*k - b*i*o + b*m*k + c*i*n - c*m*j,
		-a*f*o + a*n*g + b*e*o - b*m*g - c*e*n + c*m*f,
		a*f*k - a*j*g - b*e*k + b*i*g + c*e*j - c*i*f,
	 ];
	
	let det = a*r[0] + b*r[4] + c*r[8] + d*r[12];
	r = r.map( v => v/det );
	return r;
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
	constructor(gl,VertSource,FragSource)
	{
		//	gr: all this cache, program etc are dependent on this gl context instance, so we can just keep it
		this.gl = gl;
		this.UniformMetaCache = null;
		const FragShader = this.CompileShader( gl.FRAGMENT_SHADER, FragSource, 'Frag' );
		const VertShader = this.CompileShader( gl.VERTEX_SHADER, VertSource, 'Vert' );
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
	
	CompileShader(Type,Source,TypeName)
	{
		const gl = this.gl;
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
	
	GetUniformMeta(Name)
	{
		const Metas = this.GetUniformMetas();
		return Metas[Name];
	}
	
	GetUniformMetas()
	{
		if ( this.UniformMetaCache )
			return this.UniformMetaCache;

		const gl = this.gl;
		//	iterate and cache!
		this.UniformMetaCache = {};
		let UniformCount = gl.getProgramParameter( this.Program, gl.ACTIVE_UNIFORMS );
		for ( let i=0;	i<UniformCount;	i++ )
		{
			let UniformMeta = gl.getActiveUniform( this.Program, i );
			UniformMeta.ElementCount = UniformMeta.size;
			UniformMeta.ElementSize = undefined;
			//	match name even if it's an array
			//	todo: struct support
			let UniformName = UniformMeta.name.split('[')[0];
			//	note: uniform consists of structs, Array[Length] etc
			
			UniformMeta.Location = gl.getUniformLocation( this.Program, UniformMeta.name );
			switch( UniformMeta.type )
			{
				case gl.SAMPLER_2D:	//	samplers' value is the texture index
				case gl.INT:
				case gl.UNSIGNED_INT:
				case gl.BOOL:
					UniformMeta.ElementSize = 1;
					UniformMeta.SetValues = function(v)	{	gl.uniform1iv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT:
					UniformMeta.ElementSize = 1;
					UniformMeta.SetValues = function(v)	{	gl.uniform1fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_VEC2:
					UniformMeta.ElementSize = 2;
					UniformMeta.SetValues = function(v)	{	gl.uniform2fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_VEC3:
					UniformMeta.ElementSize = 3;
					UniformMeta.SetValues = function(v)	{	gl.uniform3fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_VEC4:
					UniformMeta.ElementSize = 4;
					UniformMeta.SetValues = function(v)	{	gl.uniform4fv( UniformMeta.Location, v );	};
					break;
				case gl.FLOAT_MAT2:
					UniformMeta.ElementSize = 2*2;
					UniformMeta.SetValues = function(v)	{	const Transpose = false;	gl.uniformMatrix2fv( UniformMeta.Location, Transpose, v );	};
					break;
				case gl.FLOAT_MAT3:
					UniformMeta.ElementSize = 3*3;
					UniformMeta.SetValues = function(v)	{	const Transpose = false;	gl.uniformMatrix3fv( UniformMeta.Location, Transpose, v );	};
					break;
				case gl.FLOAT_MAT4:
					UniformMeta.ElementSize = 4*4;
					UniformMeta.SetValues = function(v)	{	const Transpose = false;	gl.uniformMatrix4fv( UniformMeta.Location, Transpose, v );	};
					break;
					
				default:
					UniformMeta.SetValues = function(v)	{	throw "Unhandled type " + UniformMeta.type + " on " + UniformName;	};
					break;
			}
			
			this.UniformMetaCache[UniformName] = UniformMeta;
		}
		return this.UniformMetaCache;
	}
	
	//	gr: can't tell the difference between int and float, so err that wont work
	SetUniform(Uniform,Value)
	{
		const UniformMeta = this.GetUniformMeta(Uniform);
		if ( !UniformMeta )
			return;
		if( Array.isArray(Value) )					this.SetUniformArray( Uniform, UniformMeta, Value );
		else if( Value instanceof Float32Array )	this.SetUniformArray( Uniform, UniformMeta, Value );
		//else if ( Value instanceof Pop.Image )		this.SetUniformTexture( Uniform, UniformMeta, Value, this.Context.AllocTexureIndex() );
		else if ( typeof Value === 'number' )		this.SetUniformNumber( Uniform, UniformMeta, Value );
		else if ( typeof Value === 'boolean' )		this.SetUniformNumber( Uniform, UniformMeta, Value );
		else
		{
			console.log(typeof Value);
			console.log(Value);
			throw "Failed to set uniform " +Uniform + " to " + ( typeof Value );
		}
	}
	
	SetUniformArray(UniformName,UniformMeta,Values)
	{
		const ExpectedValueCount = UniformMeta.ElementSize * UniformMeta.ElementCount;
		
		//	all aligned
		if ( Values.length == ExpectedValueCount )
		{
			UniformMeta.SetValues( Values );
			return;
		}
		
		//Pop.Debug("SetUniformArray("+UniformName+") slow path");
		
		//	note: uniform iv may need to be Int32Array;
		//	https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniform
		//	enumerate the array
		let ValuesExpanded = [];
		let EnumValue = function(v)
		{
			if ( Array.isArray(v) )
				ValuesExpanded.push(...v);
			else if ( typeof v == "object" )
				v.Enum( function(v)	{	ValuesExpanded.push(v);	} );
			else
				ValuesExpanded.push(v);
		};
		Values.forEach( EnumValue );
		
		//	check array size (allow less, but throw on overflow)
		//	error if array is empty
		while ( ValuesExpanded.length < ExpectedValueCount )
			ValuesExpanded.push(0);
		//	gr: clip on overflow
		ValuesExpanded.length = Math.min(ValuesExpanded.length,ExpectedValueCount);
		/*
		 if ( ValuesExpanded.length > UniformMeta.size )
		 throw "Trying to put array of " + ValuesExpanded.length + " values into uniform " + UniformName + "[" + UniformMeta.size + "] ";
		 */
		UniformMeta.SetValues( ValuesExpanded );
	}
	/*
	SetUniformTexture(Uniform,UniformMeta,Image,TextureIndex)
	{
		const Texture = Image.GetOpenglTexture( this.Context );
		const gl = this.GetGlContext();
		//  https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
		//  WebGL provides a minimum of 8 texture units;
		const GlTextureNames = [ gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3, gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6, gl.TEXTURE7 ];
		//	setup textures
		gl.activeTexture( GlTextureNames[TextureIndex] );
		try
		{
			gl.bindTexture(gl.TEXTURE_2D, Texture );
		}
		catch(e)
		{
			Pop.Debug("SetUniformTexture: " + e);
			//  todo: bind an "invalid" texture
		}
		UniformMeta.SetValues( [TextureIndex] );
	}
	*/
	SetUniformNumber(Uniform,UniformMeta,Value)
	{
		//	these are hard to track down and pretty rare anyone would want a nan
		if ( isNaN(Value) )
			throw "Setting NaN on Uniform " + Uniform.Name;
		UniformMeta.SetValues( [Value] );
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


import FragRaySphereShader from './RayMarch.frag.glsl.js';

const AssetCaches = {};
const AssetFetchs = {};

AssetFetchs['Quad'] = GetQuad;
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
		
		Object.entries(Uniforms).forEach(kv => Shader.SetUniform(...kv) );
		
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
Params.BackgroundColour = [0,0,0];
Params.ApplyAmbientOcclusionColour = true;
Params.ApplyHeightColour = false;
Params.AmbientOcclusionMin = 0.21;
Params.AmbientOcclusionMax = 0.66;
Params.MoonColour = [1,1,1];
Params.InputRadius = 0.01;
Params.InputColour = [1,0,0];

let LastInputs = {};

let MoonSphere = [0,1,-1];
let MoonRadius = 0.10;

//	get spheres to render
function GetSceneSphereData()
{
	let SphereData = [];
	function PushSphere(x,y,z,Radius,r,g,b)
	{
		//	needs to be 8, better way to enforce/pad this?
		SphereData.push(...arguments,99);
	}
	
	PushSphere(...MoonSphere,MoonRadius,...Params.MoonColour);
	Object.values(LastInputs).forEach( Position => PushSphere(...Position,Params.InputRadius,...Params.InputColour) );
	return SphereData;
}

//	we don't use the browser anim loop as it stops in webxr mode
//	so we get update from render
function Update(Inputs,TimeStepMs=1000/60)
{
	//Object.assign(LastInputs,Inputs);
	LastInputs = Inputs;
	Params.Time += TimeStepMs;
	Params.ClearColour[2] = (Params.Time/1000) % 1;
}

function Render(RenderTarget,Camera)
{
	//	bind rt
	//	bind shader
	//	bind uniforms
	//	bind geo
	//	render geo
	RenderTarget.Clear(...Params.ClearColour);

	let Uniforms = {};
	Uniforms = Object.assign(Uniforms,Camera);
	Uniforms = Object.assign(Uniforms,Params);

	//Uniforms.ScreenToCameraTransform = Camera.ProjectionMatrix;
	Uniforms.CameraToWorldTransform = Camera.LocalToWorld;
	
	Uniforms.SphereData = GetSceneSphereData();
	
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

		this.WaitForExit = Pop.CreatePromise();
		//	store input state so we can detect button up, tracking lost/regained
		this.InputStates = {};	//	[Name] = XrInputState
		
		//	catch exit
		Session.addEventListener('end', this.WaitForExit.Resolve );
		
		this.InitLayer();
		
		//	start loop
		Session.requestAnimationFrame( this.OnFrame.bind(this) );
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
		
		//	named positions (ignoring other data atm)
		const InputPositions = {};
		const ReferenceSpace = this.ReferenceSpace;
		const FrameInputs = Array.from(Frame.session.inputSources);
		function PosFromSpace(Space)
		{
			let Pose = Frame.getPose(Space,ReferenceSpace);
			Pose = Pose ? Pose.transform.position : {};
			return [Pose.x,Pose.y,Pose.z];
		}
		
		function UpdateInputNode(InputXrSpace,InputName,Buttons)
		{
			const Position = InputXrSpace ? PosFromSpace(InputXrSpace) : [0,0,0,0];
			InputPositions[InputName] = Position;
		}
		
		//	track which inputs we updated, so we can update old inputs that have gone missing
		function UpdateInput(Input)
		{
			try
			{
				//	gr: this input name is not unique enough yet!
				const InputName = Input.handedness;
				
				//	treat joints as individual inputs as they all have their own pos
				if (Input.hand!==null)
				{
					//	enum all the joints
					function EnumJoint(JointName)
					{
						const Key = XRHand[JointName];	//	XRHand.WRIST = int = key for .hand
						const PoseSpace = Input.hand[Key];
						const NodeName = `${InputName}_${JointName}`;
						const Buttons = [];	//	skipping "button" code for now
						UpdateInputNode(PoseSpace,NodeName,Buttons);
					}
					const JointNames = Object.keys(XRHand);
					JointNames.forEach(EnumJoint);
				}
				
				//	normal controller
				if ( Input.gamepad )
				{
					if (!Input.gamepad.connected)
						return;
					
					const Buttons = Input.gamepad.buttons || [];
					UpdateInputNode( Input.targetRaySpace, InputName, Buttons );
				}
			}
			catch(e)
			{
				Pop.Warning(`Input error ${e}`);
			}
		}
		FrameInputs.forEach(UpdateInput);
		
		
		this.OnUpdate(InputPositions,TimeMs);
		
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
			Camera.LocalToWorld = View.transform.matrix;
			Camera.WorldToLocal = View.transform.inverse.matrix;
			Camera.ProjectionMatrix = View.projectionMatrix;
			Camera.ScreenToCameraTransform = InvertMatrix4x4(View.projectionMatrix);
			Camera.CameraToScreenTransform = View.projectionMatrix;
			
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
		this.OnUpdate = function(){};

		let RenderCallback = function(Timestamp)
		{
			window.requestAnimationFrame(RenderCallback.bind(this));
			this.OnRenderCallback(RenderContext);
		}
		RenderCallback.call(this);
	}
	
	OnRenderCallback(RenderContext)
	{
		function BindRenderTarget()
		{
			const gl = RenderContext;
			const FrameBuffer = null;
			
			//	this w/h should be canvas's w/h and that should be in sync with the element's getBoundingClientRect
			//	in pixels!
			const Viewport = [0,0,1000,1000];
			
			gl.bindFramebuffer( gl.FRAMEBUFFER, FrameBuffer );
			gl.viewport( ...Viewport );
			gl.scissor( ...Viewport );
		}
		
		//	from webxr
		const ProjectionMatrix = [0.9172856211662292, 0, 0, 0, 0, 0.8335369825363159, 0, 0, -0.1740722358226776, -0.10614097863435745, -1.0001999139785767, -1, 0, 0, -0.2000199854373932, 0];
		const TransformMatrix = [0.9638781547546387, 0.049760766327381134, -0.2616539001464844, 0, -0.024722494184970856, 0.9948665499687195, 0.09812905639410019, 0, 0.2651937007904053, -0.08811571449041367, 0.9601603746414185, 0, -0.052230026572942734, 1.264850378036499, -0.05096454545855522, 1];

		this.Camera.LocalToWorld = TransformMatrix;
		this.Camera.WorldToLocal = InvertMatrix4x4(this.Camera.LocalToWorld);
		this.Camera.ProjectionMatrix = ProjectionMatrix;
		this.Camera.ScreenToCameraTransform = InvertMatrix4x4(ProjectionMatrix);
		this.Camera.CameraToScreenTransform = ProjectionMatrix;

		let RenderTarget = new RenderTarget_t(RenderContext);
		BindRenderTarget();
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
	
	const ScreenDevice = new ScreenDevice_t(RenderContext);
	ScreenDevice.OnRender = Render;
	ScreenDevice.OnUpdate = Update;
	
	while(true)
	{
		try
		{
			const Device = await CreateWebxrDevice(RenderContext,OnWaitForCallback);
			Device.OnRender = Render;
			Device.OnUpdate = Update;
			//	wait for device to die
			await Device.WaitForExit;
		}
		catch(e)
		{
			Pop.Warning(e);
			await Pop.Yield(1000);
		}
	}
}
