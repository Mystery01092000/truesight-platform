import { Pagination } from "truesight-platform";

const noop = () => {};

export const FirstPage = () => (
  <Pagination
    page={0}
    pageCount={13}
    pageSize={25}
    total={312}
    onPageChange={noop}
    onPageSizeChange={noop}
    className="w-full"
  />
);

export const MiddlePage = () => (
  <Pagination
    page={5}
    pageCount={13}
    pageSize={25}
    total={312}
    onPageChange={noop}
    onPageSizeChange={noop}
    className="w-full"
  />
);

export const LastPage = () => (
  <Pagination
    page={12}
    pageCount={13}
    pageSize={25}
    total={312}
    onPageChange={noop}
    onPageSizeChange={noop}
    className="w-full"
  />
);

export const CompactWithoutPageSize = () => (
  <Pagination
    page={0}
    pageCount={2}
    pageSize={50}
    total={64}
    onPageChange={noop}
    className="w-full"
  />
);
