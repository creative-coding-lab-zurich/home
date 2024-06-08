require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/request",
  "esri/rest/query",
  "esri/Graphic",
  "esri/geometry/Mesh",
  "esri/geometry/support/MeshComponent",
  "esri/core/promiseUtils",
  "esri/layers/GraphicsLayer",
  "lib/poly2tri"
], function (
  Map,
  SceneView,
  esriRequest,
  queryTask,
  Graphic,
  Mesh,
  MeshComponent,
  promiseUtils,
  GraphicsLayer,
  poly2tri
) {

  const random = new Math.seedrandom("map-lowpoly");

  const meshLayer = new GraphicsLayer();

  const equalEarth = {
    wkid: 54035
  };

  const map = new Map({
    layers: [meshLayer],
    ground: {
      opacity: 0
    },
  });

  const view = new SceneView({
    container: "viewDiv",
    map: map,
    camera: {
      position: {
        x: 1536849.38227,
        y: 433810.41887,
        z: 44620859.616,
        spatialReference: 54035
      },
      heading: 0.00,
      tilt: 0.50
    },
    viewingMode: "local",
    alphaCompositingEnabled: true,
    qualityProfile: "high",
    environment: {
      background: {
        type: "color",
        color: [0, 0, 0, 0]
      },
      lighting: {
        directShadowsEnabled: true
      },
      starsEnabled: false,
      atmosphereEnabled: false
    },
    ui: {
      components: []
    },
    spatialReference: equalEarth,
    constraints: {
      tilt: {
        max: 20
      }
    },
  });

  window.view = view;

  const generalizedWorldUrl = "https://services2.arcgis.com/cFEFS0EWrhfDeVw9/arcgis/rest/services/generalizedworldequalearth/FeatureServer/0";

  const colors = [[245, 141, 86, 200], [245, 197, 86, 200], [245, 86, 139, 200], [86, 139, 245, 200], [157, 207, 93, 200]]

  promiseUtils.eachAlways([
    queryTask.executeQueryJSON(generalizedWorldUrl, { where: "1=1", returnGeometry: true }),
    esriRequest("./data/randompointequalearth.json", { responseType: "json" })
  ])
    .then(function (results) {

      let steinerPoints = {};
      results[1].value.data.features.forEach(function (feature) {
        const fid = feature.properties.FID_1;
        if (steinerPoints[fid]) {
          steinerPoints[fid].push(feature.geometry.coordinates);
        } else {
          steinerPoints[fid] = [feature.geometry.coordinates]
        }
      });

      results[0].value.features.forEach(function (feature) {

        const fid = feature.attributes.FID_1;
        const innerPoints = null ? !steinerPoints[fid] : steinerPoints[fid];
        const tin = generateTIN(feature.geometry, innerPoints);

        const vertices = tin.vertices.map(function (vertex) {
          return [vertex.x, vertex.y, 200000 + random() * 700000]
        })

        const flatPosition = [].concat.apply([], vertices);

        const faces = tin.triangles.map(function (t) {
          const points = t.getPoints();
          return points.map(function (p) {
            return p.vertexId;
          });
        });
        const colorArray = tin.vertices.map(_ => {
          return colors[Math.floor(Math.random() * 5)]
        });
        flatColor = [].concat.apply([], colorArray);
        console.log(flatColor);
        const flatFaces = [].concat.apply([], faces);

        const meshComponent = new MeshComponent({
          faces: flatFaces,
          shading: "flat"
        });

        const mesh = new Mesh({
          components: [meshComponent],
          vertexAttributes: {
            position: flatPosition,
            color: flatColor
          },
          spatialReference: equalEarth
        });

        const graphic = new Graphic({
          geometry: mesh,
          symbol: {
            type: "mesh-3d",
            symbolLayers: [{ type: "fill" }]
          }
        });

        meshLayer.add(graphic);
      });
    });

  function generateTIN(polygon, innerPoints) {
    let vertices = [];
    let steinerPoints = null;

    if (innerPoints) {
      steinerPoints = innerPoints.map(function (coords) {
        vertexId = vertices.length;
        vertices.push({ x: coords[0], y: coords[1], vertexId });
        return { x: coords[0], y: coords[1], vertexId };
      });
    }

    const outerRing = polygon.rings[0].map(function (coords) {
      vertexId = vertices.length;
      vertices.push({ x: coords[0], y: coords[1], vertexId });
      return { x: coords[0], y: coords[1], vertexId };
    });
    // poly2tri takes as an input the polyline and not a polygon
    // so we remove the last coordinate which is the same as the first one
    outerRing.pop();
    vertices.pop();

    const sweepContext = new poly2tri.SweepContext(outerRing, { cloneArrays: true });
    if (steinerPoints) {
      sweepContext.addPoints(steinerPoints);
    }
    sweepContext.triangulate();

    const triangles = sweepContext.getTriangles();
    return {
      triangles,
      vertices
    };
  }
});
