function _chart(d3, data) {
  // Specify the chart's dimensions.
  const width = 928;
  const height = width;
  const radius = width / 12;

  // Create the color scale with richer colors
  const richerColors = [
    "#FF9AA2", "#A8D8B9", "#8AC6D1", "#FFDAC1", "#E2F0CB",
    "#B5EAD7", "#C7CEEA", "#F6D5E5", "#FFE5B4", "#D4A5A5"
  ];

  const color = d3.scaleOrdinal()
    .domain(data.children.map(d => d.name))
    .range(richerColors);

  // Compute the layout.
  const partition = data => d3.partition()
    .size([2 * Math.PI, radius * radius])
    (d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value));

  const root = partition(data);

  // Create the arc generator.
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius(d => Math.sqrt(d.y0))
    .outerRadius(d => Math.sqrt(d.y1));

  // Create the SVG container.
  const svg = d3.create("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, width])
    .attr("class", "sunburst-chart");

  // Create a group for the paths and labels
  const g = svg.append("g");

  // Append the arcs.
  const path = g.append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
    .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
    .attr("fill-opacity", d => arcVisible(d) ? (d.children ? 0.6 : 0.4) : 0)
    .attr("d", arc);

  // Make them clickable if they have children and add hover animation.
  path.filter(d => d.children)
    .style("cursor", "pointer")
    .on("click", clicked)
    .on("mouseover", function() {
      d3.select(this).attr("fill-opacity", 1);
    })
    .on("mouseout", function(event, d) {
      d3.select(this).attr("fill-opacity", arcVisible(d) ? (d.children ? 0.6 : 0.4) : 0);
    });

  // Function to calculate font size
  function calculateFontSize(d) {
    const angle = d.x1 - d.x0;
    const radius = Math.sqrt((d.y0 + d.y1) / 2);
    const circumference = angle * radius;
    const maxFontSize = Math.min(14, circumference / 4);
    const minFontSize = 8;
    return Math.max(minFontSize, maxFontSize);
  }

  // Function to insert line breaks
  function insertLineBreaks(text) {
    const words = text.split(/\s+/);
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      if (currentLine.length + words[i].length + 1 <= 10) {
        currentLine += " " + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
    return lines;
  }

  // Append the labels
  const label = g.append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .style("user-select", "none")
    .selectAll("text")
    .data(root.descendants().slice(1))
    .join("text")
    .attr("dy", "0.35em")
    .attr("fill-opacity", d => +labelVisible(d))
    .attr("transform", d => labelTransform(d))
    .style("font-size", d => `${calculateFontSize(d)}px`)
    .each(function(d) {
      const lines = insertLineBreaks(d.data.name);
      d3.select(this).selectAll("tspan")
        .data(lines)
        .join("tspan")
        .attr("x", 0)
        .attr("dy", (_, i) => i === 0 ? "0em" : "1em")
        .text(d => d);
    });

  const parent = svg.append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", clicked);

  // Add tooltip to the center circle
  const tooltipG = svg.append("g")
    .attr("pointer-events", "all")
    .style("cursor", "pointer")
    .on("click", () => clicked(null, root));

  const tooltipRect = tooltipG.append("rect")
    .attr("x", -40)
    .attr("y", -10)
    .attr("width", 80)
    .attr("height", 20)
    .attr("fill", "#f6f6f6")
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("fill-opacity", 0);

  const tooltipText = tooltipG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("font-size", "7px")
    .attr("fill-opacity", 0)
    .text("Go to previous layer");

  parent
    .on("mouseover", () => {
      tooltipRect.attr("fill-opacity", 0.5);
      tooltipText.attr("fill-opacity", 0.5);
    })
    .on("mouseout", () => {
      tooltipRect.attr("fill-opacity", 0);
      tooltipText.attr("fill-opacity", 0);
    });

  // Handle zoom on click.
  function clicked(event, p) {
    if (!p) p = root;
    parent.datum(p.parent || root);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });

    const t = svg.transition().duration(750);

    path.transition(t)
      .tween("data", d => {
        const i = d3.interpolate(d.current, d.target);
        return t => d.current = i(t);
      })
      .filter(function(d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
      .attrTween("d", d => () => arc(d.current));

    label.transition(t)
      .attr("fill-opacity", d => +labelVisible(d.target))
      .attrTween("transform", d => () => labelTransform(d.current))
      .tween("text", function(d) {
        const i = d3.interpolate(d.current, d.target);
        return function(t) {
          d.current = i(t);
          const fontSize = calculateFontSize(d.current);
          d3.select(this)
            .style("font-size", `${fontSize}px`)
            .attr("transform", labelTransform(d.current));
          
          const lines = insertLineBreaks(d.data.name);
          d3.select(this).selectAll("tspan")
            .data(lines)
            .join("tspan")
            .attr("x", 0)
            .attr("dy", (_, i) => i === 0 ? "0em" : "1em")
            .text(d => d);
        };
      });

    // Remove paths and labels that are no longer visible
    path.filter(d => !arcVisible(d.target)).remove();
    label.filter(d => !labelVisible(d.target)).remove();
  }

  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }

  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (Math.sqrt(d.y0) + Math.sqrt(d.y1)) / 2;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  return svg.node();
}

function _data(FileAttachment) {
  return FileAttachment("data.json").json();
}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["data.json", {url: new URL("./data/data.json", import.meta.url), mimeType: "application/json", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer("chart")).define("chart", ["d3","data"], _chart);
  main.variable(observer("data")).define("data", ["FileAttachment"], _data);
  return main;
}
