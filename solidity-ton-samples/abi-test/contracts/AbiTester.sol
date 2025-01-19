pragma tvm-solidity >= 0.72.0;
// Use expiration time for external messages
pragma AbiHeader expire;

contract AbiTester {

    int8 m_a;
    varint m_b;
    bool m_c;
    mapping(uint => mapping(uint => uint)) m_d;
    address m_e;
    string m_str;
    bytes m_data;
    optional(TvmCell) m_optCell;
    Point m_p;
    mapping(uint => Point) m_points;
    optional(Point3d) m_point3d;
    uint[] m_arr;

    function setA(int8 a) public  {
//        require(msg.pubkey() == tvm.pubkey(), 101);
        tvm.accept();
        m_a = a;
    }

    function setAddress(address newAddr) public {
        m_e = newAddr;
    }

    function getDeltaA(int8 deltaA) getter returns (int8) {
        return m_a + deltaA;
    }

    struct Point {
        uint x;
        uint y;
    }

    struct Point3d {
        uint z;
        Point p;
    }

    struct Point4d {
        Point p0;
        Point p1;
        bool ok;
    }

    function f(
        int8 a,
        varint b,
        bool c,
        mapping(uint => mapping(uint => uint)) d,
        address e,
        string str,
        bytes data,
        optional(TvmCell) optCell,
        Point p,
        mapping(uint => Point) points,
        optional(Point3d) point3d,
        uint[] arr
    ) public {
        require(!d.empty(), 102);
        require(arr.length == 2, 103);

        m_a = a;
        m_b = b;
        m_c = c;
        m_d = d;
        m_e = e;
        m_str = str;
        m_data = data;
        m_optCell = optCell;
        m_p = p;
        m_points = points;
        m_point3d = point3d;
        m_arr = arr;
    }

    function getSomeInfo(
        int8 a,
        varint b,
        bool c,
        mapping(uint => mapping(uint => uint)) d,
        address e,
        string str,
        bytes data,
        TvmCell cell,
        optional(TvmCell) optCell,
        Point p,
        mapping(uint => Point) points,
        optional(Point3d) point3d,
        uint[] arr,
        Point4d p4,
        mapping(uint => Point) pointMap
    ) getter returns (
        int8 a2,
        varint b2,
        bool c2,
        mapping(uint => mapping(uint => uint)) d2,
        address e2,
        string str2,
        bytes data2,
        TvmCell cell2,
        optional(TvmCell) optCell2,
        Point p2,
        mapping(uint => Point) points2,
        optional(Point3d) point3d2,
        uint[] arr2,
        Point4d p42,
        mapping(uint => Point) pointMap2
    ) {
        require(!d.empty(), 102);
        require(d[12][13] == 14, 103);
        require(arr[0] == 12, 104);
        require(arr[1] == 13, 105);
        return (
            a + 10,
            b,
            c,
            d,
            e,
            "Hello, " + str,
            data,
            cell,
            optCell,
            p,
            points,
            point3d,
            arr,
            p4,
            pointMap
        );
    }
}
