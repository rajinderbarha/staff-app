import { backToJobDetail } from "../backToJobDetail";

describe("backToJobDetail", () => {
  it("returns to the existing Job Detail instead of pushing another one", () => {
    const navigation = { navigate: jest.fn(), popTo: jest.fn() };
    backToJobDetail(navigation, "j1");
    expect(navigation.popTo).toHaveBeenCalledWith("JobDetail", { jobId: "j1" });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("falls back to navigate when the navigator has no popTo", () => {
    const navigation = { navigate: jest.fn() };
    backToJobDetail(navigation, "j1");
    expect(navigation.navigate).toHaveBeenCalledWith("JobDetail", { jobId: "j1" });
  });
});
