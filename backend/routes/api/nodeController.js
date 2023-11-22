const Node = require("../Schema/Node");

exports.getNode = async (req, res) => {
  if (!req.params.handle)
    return res.send({ error: "no such wikipedia page exists" });

  try {
    const pageTitle = req.params.title;
    const node = await Node.findById(pageTitle);
    return res.send({ data: node });
  } catch (err) {
    return res.send({ error: console.log(err) });
  }
};
