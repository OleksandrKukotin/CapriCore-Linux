# Native NPU

This feature was added in Capri 1.1.0. The vendor runtimes below are Windows builds; NPU support on Linux has not been qualified.

## Run a language model on an NPU

In **Settings → Language model → Model devices**, select the detected AMD or Intel NPU and click **Set up NPU and restart**. Capri prepares Qwen 2.5 1.5B for that device, verifies the download, and runs a short generation. The selection takes effect after the test passes. Voice uses its own device setting.

AMD requires Windows 11 24H2 or later, an NPU driver, and AMD Ryzen AI Software 1.9 or later in its default installation folder. Intel requires Windows 11 22H2 or later and an NPU driver. Capri installs the private Intel OpenVINO runtime as needed. The device selector shows installation guidance when a prerequisite is missing.

Use **Advanced NPU setup** for a different model, a custom vendor runtime, or a compatible Qualcomm QNN setup. The model folder must contain only local model data. Capri exchanges requests and replies with the NPU worker over private process pipes.

Hardware and OS support depends on each vendor’s runtime and driver. An Intel SDK and its hardware enumeration were checked on a PC without an NPU; actual NPU generation and AMD/Qualcomm hardware remain to be qualified. Native NPU is experimental.
