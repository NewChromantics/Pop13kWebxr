export default `
precision highp float;

varying vec2 LocalUv;
uniform mat4 ScreenToCameraTransform;
uniform mat4 CameraToWorldTransform;

uniform bool DrawStepHeat;
uniform bool ApplyAmbientOcclusionColour;
uniform bool ApplyHeightColour;
uniform float AmbientOcclusionMin;
uniform float AmbientOcclusionMax;
uniform float HeightMapStepBack;
uniform vec3 BackgroundColour;
const bool FlipSample = true;
const vec3 SphereColour = vec3(0.5,0.5,1.0);

#define MAX_STEPS	40
#define FAR_Z		100.0

//uniform vec4 MoonSphere;// = vec4(0,0,-3,1.0);
const vec4 MoonSphere = vec4(0,0,-3,1.0);

struct TRay
{
	vec3 Pos;
	vec3 Dir;
};

vec3 ScreenToWorld(vec2 uv,float z)
{
	float x = mix( -1.0, 1.0, uv.x );
	float y = mix( 1.0, -1.0, uv.y );
	vec4 ScreenPos4 = vec4( x, y, z, 1.0 );
	vec4 CameraPos4 = ScreenToCameraTransform * ScreenPos4;
	vec4 WorldPos4 = CameraToWorldTransform * CameraPos4;
	vec3 WorldPos = WorldPos4.xyz / WorldPos4.w;
	
	return WorldPos;
}

//	gr: returning a TRay, or using TRay as an out causes a very low-precision result...
void GetWorldRay(out vec3 RayPos,out vec3 RayDir)
{
	float Near = 0.01;
	float Far = FAR_Z;
	RayPos = ScreenToWorld( LocalUv, Near );
	RayDir = ScreenToWorld( LocalUv, Far ) - RayPos;
	
	//	gr: this is backwards!
	RayDir = -normalize( RayDir );
}

float Range(float Min,float Max,float Value)
{
	return (Value-Min) / (Max-Min);
}
float Range01(float Min,float Max,float Value)
{
	return clamp(0.0,1.0,Range(Min,Max,Value));
}

vec3 NormalToRedGreen(float Normal)
{
	if ( Normal < 0.5 )
	{
		Normal /= 0.5;
		return vec3( 1.0, Normal, 0.0 );
	}
	else
	{
		Normal -= 0.5;
		Normal /= 0.5;
		return vec3( 1.0-Normal, 1.0, 0.0 );
	}
}


vec3 GetRayPositionAtTime(TRay Ray,float Time)
{
	return Ray.Pos + ( Ray.Dir * Time );
}


void GetMoonHeightLocal(vec3 MoonNormal,out float Height)
{
	Height = 0.0;
}


void GetMoonColourHeight(vec3 MoonNormal,out vec3 Colour,out float Height)
{
	GetMoonHeightLocal( MoonNormal, Height );
	Colour = SphereColour;
}




float DistanceToMoon(vec3 Position)
{
	vec3 DeltaToSurface = MoonSphere.xyz - Position;
	vec3 Normal = -normalize( DeltaToSurface );
	float MoonRadius = MoonSphere.w;
	vec3 MoonSurfacePoint = MoonSphere.xyz + Normal * MoonRadius;
	
	float Height;
	GetMoonHeightLocal( Normal, Height );
	
	MoonSurfacePoint += Normal * Height * MoonSphere.w;
	
	float Distance = length( Position - MoonSurfacePoint );
	
	//	do something more clever, like check against surface heights where the height could get in our way
	//	this scalar (where it works) is relative to the height, so maybe we can work that out...
	Distance *= HeightMapStepBack;
	
	return Distance;
}

vec3 GetMoonColour(vec3 Position)
{
	//	duplicate code!
	vec3 DeltaToSurface = MoonSphere.xyz - Position;
	vec3 Normal = -normalize( DeltaToSurface );
	float MoonRadius = MoonSphere.w;
	vec3 MoonSurfacePoint = MoonSphere.xyz + Normal * MoonRadius;
	
	float Height;
	vec3 Colour;
	GetMoonColourHeight( Normal, Colour, Height );
	return Colour;
}




//	returns intersction pos, w=success
vec4 RayMarchSpherePos(TRay Ray,out float StepHeat)
{
	const float MinDistance = 0.001;
	const float CloseEnough = MinDistance;
	const float MinStep = MinDistance;
	const float MaxDistance = FAR_Z;
	const int MaxSteps = MAX_STEPS;
	
	//	start close
	float RayTime = DistanceToMoon( Ray.Pos );//0.01;
	
	for ( int s=0;	s<MaxSteps;	s++ )
	{
		StepHeat = float(s)/float(MaxSteps);
		vec3 Position = Ray.Pos + Ray.Dir * RayTime;
		float MoonDistance = DistanceToMoon( Position );
		float HitDistance = MoonDistance;
		
		//RayTime += max( HitDistance, MinStep );
		RayTime += HitDistance;
		if ( HitDistance < CloseEnough )
			return vec4(Position,1);
		
		//	ray gone too far
		if (RayTime > MaxDistance)
			return vec4(Position,0);
	}
	//	ray never got close enough
	StepHeat = 1.0;
	return vec4(0,0,0,-1);
}


vec4 RayMarchSphere(TRay Ray,out float StepHeat)
{
	vec4 Intersection = RayMarchSpherePos( Ray, StepHeat );
	//if ( Intersection.w < 0.0 )
	//	return vec4(1,0,0,0);
	
	vec3 Colour = GetMoonColour( Intersection.xyz );
	return vec4( Colour, Intersection.w );
}



void main()
{
	TRay Ray;
	GetWorldRay(Ray.Pos,Ray.Dir);
	vec4 Colour = vec4(BackgroundColour,0.0);
	
	float StepHeat;
	vec4 SphereColour = RayMarchSphere( Ray, StepHeat );
	if ( DrawStepHeat )
		SphereColour.xyz = NormalToRedGreen( 1.0 - StepHeat );
	
	if ( ApplyAmbientOcclusionColour )
	{
		float Mult = Range01( AmbientOcclusionMin, AmbientOcclusionMax, 1.0-StepHeat );
		SphereColour.xyz *= Mult;
	}
	
	
	Colour = mix( Colour, SphereColour, max(0.0,SphereColour.w) );
	gl_FragColor = Colour;
}



`;
	  
	  